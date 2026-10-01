// These specs talk to the practice API (perf/server) with plain HTTP requests and never open a
// browser, so they use Playwright's own `test` instead of the console-error guard in ../support/fixtures.
import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

test.describe('health and unknown routes', () => {
  test('GET /api/health', async ({ request }) => {
    const response = await request.get('api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', uptimeSeconds: expect.any(Number), requests: expect.any(Number) });
  });

  test('unknown endpoint and wrong method return JSON errors', async ({ request }) => {
    const unknown = await request.get('api/does-not-exist');
    expect(unknown.status()).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'Unknown endpoint' });

    const wrongMethod = await request.post('api/health');
    expect(wrongMethod.status()).toBe(405);
    expect(await wrongMethod.json()).toEqual({ error: 'Method not allowed' });
  });

  test('API responses allow cross-origin use', async ({ request }) => {
    const response = await request.get('api/health');
    expect(response.headers()['access-control-allow-origin']).toBe('*');
  });
});

test.describe('products', () => {
  test('first page with defaults', async ({ request }) => {
    const body = await (await request.get('api/products')).json();
    expect(body).toMatchObject({ page: 1, size: 5, total: 12 });
    expect(body.items).toHaveLength(5);
    expect(body.items[0]).toMatchObject({ id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 7999 });
  });

  test('pagination covers every product exactly once', async ({ request }) => {
    const ids: number[] = [];
    for (const page of [1, 2, 3]) {
      const body = await (await request.get(`api/products?page=${page}&size=5`)).json();
      ids.push(...body.items.map((p: { id: number }) => p.id));
    }
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const beyond = await (await request.get('api/products?page=99')).json();
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(12);
  });

  test('search and category filters', async ({ request }) => {
    const search = await (await request.get('api/products?q=keyboard')).json();
    expect(search.items.map((p: { name: string }) => p.name)).toEqual(['Mechanical Keyboard']);
    const books = await (await request.get('api/products?category=Books&size=50')).json();
    expect(books.total).toBe(3);
    for (const product of books.items) expect(product.category).toBe('Books');
  });

  test('invalid paging parameters are rejected', async ({ request }) => {
    for (const query of ['size=0', 'size=51', 'size=abc', 'page=0', 'page=1.5']) {
      const response = await request.get(`api/products?${query}`);
      expect(response.status(), query).toBe(400);
      expect(await response.json()).toHaveProperty('error');
    }
  });

  test('single product, and 404 for an unknown id', async ({ request }) => {
    const found = await request.get('api/products/2');
    expect(found.status()).toBe(200);
    expect(await found.json()).toMatchObject({ id: 2, name: 'Mechanical Keyboard' });

    const missing = await request.get('api/products/999');
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Product not found' });
  });
});

test.describe('slow', () => {
  test('waits at least the requested time', async ({ request }) => {
    const started = Date.now();
    const response = await request.get('api/slow?ms=300');
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    expect(await response.json()).toEqual({ delayMs: 300 });
  });

  test('jitter stays inside [ms, ms + jitter]', async ({ request }) => {
    const delays: number[] = [];
    for (let i = 0; i < 12; i++) {
      const body = await (await request.get(`api/slow?ms=20&jitter=60&seed=5&i=${i}`)).json();
      delays.push(body.delayMs);
    }
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(20);
      expect(delay).toBeLessThanOrEqual(80);
    }
    expect(new Set(delays).size).toBeGreaterThan(3); // really varies
  });

  test('the same seed and index always give the same delay', async ({ request }) => {
    const get = async () => (await (await request.get('api/slow?ms=10&jitter=100&seed=42&i=3')).json()).delayMs;
    expect(await get()).toBe(await get());
  });

  test('limits are enforced', async ({ request }) => {
    for (const query of ['ms=10001', 'ms=-1', 'ms=abc', 'ms=9000&jitter=2000']) {
      const response = await request.get(`api/slow?${query}`);
      expect(response.status(), query).toBe(400);
    }
  });
});

test.describe('flaky', () => {
  const statusOf = async (request: APIRequestContext, query: string) => (await request.get(`api/flaky?${query}`)).status();

  test('rate 0 never fails and rate 1 always fails', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      expect(await statusOf(request, `rate=0&seed=1&i=${i}`)).toBe(200);
      expect(await statusOf(request, `rate=1&seed=1&i=${i}`)).toBe(500);
    }
  });

  test('a seeded run is reproducible and close to the requested rate', async ({ request }) => {
    const run = async () => Promise.all(Array.from({ length: 200 }, (_, i) => statusOf(request, `rate=0.5&seed=7&i=${i}`)));
    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    const failures = first.filter((s) => s === 500).length;
    expect(failures).toBeGreaterThan(70);
    expect(failures).toBeLessThan(130);
  });

  test('an invalid rate is rejected', async ({ request }) => {
    expect(await statusOf(request, 'rate=1.5')).toBe(400);
    expect(await statusOf(request, 'rate=-0.1')).toBe(400);
  });
});

test.describe('status', () => {
  test('answers with the requested status code', async ({ request }) => {
    for (const code of [200, 201, 202, 204, 404, 418, 429, 503]) {
      const response = await request.get(`api/status/${code}`, { maxRedirects: 0 });
      expect(response.status(), `status/${code}`).toBe(code);
    }
  });

  test('rejects codes outside 200-599', async ({ request }) => {
    expect((await request.get('api/status/100')).status()).toBe(400);
    expect((await request.get('api/status/600')).status()).toBe(400);
  });
});

test.describe('payload', () => {
  test('returns the requested number of bytes', async ({ request }) => {
    const response = await request.get('api/payload?kb=10');
    expect((await response.body())).toHaveLength(10 * 1024);
    expect(response.headers()['content-encoding']).toBeUndefined();
    expect((await (await request.get('api/payload?kb=0')).body())).toHaveLength(0);
  });

  test('gzip=1 compresses for clients that accept it', async ({ request }) => {
    const plain = await request.get('api/payload?kb=50&gzip=0');
    const zipped = await request.get('api/payload?kb=50&gzip=1');
    expect(zipped.headers()['content-encoding']).toBe('gzip');
    expect((await zipped.body())).toHaveLength(50 * 1024); // the client decompressed it
    expect(Number(zipped.headers()['content-length'])).toBeLessThan(Number(plain.headers()['content-length']));
  });

  test('a seed makes the content reproducible', async ({ request }) => {
    const get = async (seed: number) => (await request.get(`api/payload?kb=2&seed=${seed}`)).text();
    expect(await get(1)).toBe(await get(1));
    expect(await get(1)).not.toBe(await get(2));
  });

  test('size limit is enforced', async ({ request }) => {
    expect((await request.get('api/payload?kb=5121')).status()).toBe(400);
    expect((await request.get('api/payload?kb=-1')).status()).toBe(400);
  });
});

test.describe('static files', () => {
  test('serves the published site', async ({ request }) => {
    const home = await request.get('');
    expect(home.status()).toBe(200);
    expect(home.headers()['content-type']).toContain('text/html');
    expect(await home.text()).toContain('Playwright Practice Lab');

    expect((await request.get('pages/login.html')).status()).toBe(200);
    expect((await request.get('assets/css/styles.css')).headers()['content-type']).toContain('text/css');
    expect((await request.get('assets/data/products.json')).headers()['content-type']).toContain('application/json');
  });

  test('does not expose anything that is not published', async ({ request }) => {
    for (const url of ['package.json', 'tests/support/fixtures.ts', 'perf/server/server.js', '.git/config', 'node_modules/', 'nope.html']) {
      expect((await request.get(url)).status(), url).toBe(404);
    }
  });

  test('path traversal is blocked', async ({ request }) => {
    for (const url of ['assets/..%2fpackage.json', 'assets/..%2f..%2fpackage.json', '%2e%2e/package.json']) {
      expect((await request.get(url)).status(), url).toBe(404);
    }
  });
});
