// Contract tests for the capacity endpoints. State is shared by the whole server, so each test uses
// its own `key` (a separate rate-limit bucket or queue) to stay independent when tests run in parallel.
import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const unique = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

test.describe('rate limit (/api/limited)', () => {
  test('allows `limit` requests per window, then answers 429 with Retry-After', async ({ request }) => {
    const key = unique();
    const get = () => request.get(`api/limited?limit=3&window=5&key=${key}`);

    for (const remaining of [2, 1, 0]) {
      const ok = await get();
      expect(ok.status()).toBe(200);
      expect(ok.headers()['x-ratelimit-limit']).toBe('3');
      expect(ok.headers()['x-ratelimit-remaining']).toBe(String(remaining));
      expect(await ok.json()).toEqual({ ok: true, remaining });
    }

    const limited = await get();
    expect(limited.status()).toBe(429);
    const retryAfter = Number(limited.headers()['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(5);
    expect(await limited.json()).toMatchObject({ error: 'Too many requests', retryAfterSeconds: retryAfter });
  });

  test('the window resets after `window` seconds', async ({ request }) => {
    const key = unique();
    const get = () => request.get(`api/limited?limit=1&window=1&key=${key}`);
    expect((await get()).status()).toBe(200);
    expect((await get()).status()).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await get()).status()).toBe(200);
  });

  test('keys are limited independently', async ({ request }) => {
    const [a, b] = [unique(), unique()];
    expect((await request.get(`api/limited?limit=1&window=5&key=${a}`)).status()).toBe(200);
    expect((await request.get(`api/limited?limit=1&window=5&key=${a}`)).status()).toBe(429);
    expect((await request.get(`api/limited?limit=1&window=5&key=${b}`)).status()).toBe(200);
  });

  test('without a key the bearer token is the key', async ({ request }) => {
    const login = async () => (await (await request.post('api/login', { data: { username: 'student', password: 'Password123!' } })).json()).token;
    const [first, second] = [await login(), await login()];
    const get = (token: string) => request.get('api/limited?limit=1&window=5', { headers: { Authorization: `Bearer ${token}` } });
    expect((await get(first)).status()).toBe(200);
    expect((await get(first)).status()).toBe(429);
    expect((await get(second)).status()).toBe(200);
  });

  test('invalid parameters are rejected', async ({ request }) => {
    for (const query of ['limit=0', 'limit=1001', 'window=0', 'window=61', `key=${'x'.repeat(65)}`]) {
      expect((await request.get(`api/limited?${query}`)).status(), query).toBe(400);
    }
  });
});

test.describe('capacity-limited resource (/api/queue)', () => {
  const fire = (request: APIRequestContext, query: string, count: number) =>
    Promise.all(Array.from({ length: count }, () => request.get(`api/queue?${query}`)));

  test('one worker serves requests one after another', async ({ request }) => {
    const responses = await fire(request, `workers=1&ms=200&key=${unique()}`, 3);
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200]);
    const waits = (await Promise.all(responses.map((r) => r.json()))).map((b) => b.waitedMs).sort((x, y) => x - y);
    expect(waits[0]).toBeLessThan(100); // got the worker immediately
    expect(waits[1]).toBeGreaterThanOrEqual(150); // waited for the first to finish
    expect(waits[2]).toBeGreaterThanOrEqual(300); // waited for two
  });

  test('capacity grows with the number of workers', async ({ request }) => {
    const bodies = await Promise.all((await fire(request, `workers=2&ms=200&key=${unique()}`, 4)).map((r) => r.json()));
    const waits = bodies.map((b) => b.waitedMs).sort((x, y) => x - y);
    expect(waits[0]).toBeLessThan(100);
    expect(waits[1]).toBeLessThan(100); // two workers: the first two start at once
    expect(waits[2]).toBeGreaterThanOrEqual(150);
    expect(waits[3]).toBeGreaterThanOrEqual(150);
    for (const body of bodies) expect(body.totalMs).toBeGreaterThanOrEqual(body.waitedMs + 190);
  });

  test('a full queue sheds load with 503 and Retry-After', async ({ request }) => {
    const responses = await fire(request, `workers=1&ms=400&maxQueue=1&key=${unique()}`, 4);
    const statuses = responses.map((r) => r.status()).sort();
    expect(statuses).toEqual([200, 200, 503, 503]); // one running, one waiting, two turned away
    const rejected = responses.find((r) => r.status() === 503)!;
    expect(rejected.headers()['retry-after']).toBe('1');
    expect(await rejected.json()).toEqual({ error: 'Queue is full' });
  });

  test('the queue is empty again afterwards', async ({ request }) => {
    const key = unique();
    await fire(request, `workers=2&ms=50&key=${key}`, 5);
    const state = await (await request.get('api/_state')).json();
    expect(state.queues[`${key}|2`]).toEqual({ active: 0, waiting: 0 });
  });

  test('invalid parameters are rejected', async ({ request }) => {
    for (const query of ['workers=0', 'workers=21', 'ms=-1', 'ms=10001', 'maxQueue=-1', 'maxQueue=10001', `key=${'x'.repeat(65)}`]) {
      expect((await request.get(`api/queue?${query}`)).status(), query).toBe(400);
    }
  });
});
