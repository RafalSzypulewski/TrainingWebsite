// /api/_reset wipes the state of the WHOLE server, so these tests must not run while other API tests
// are using it. The Playwright config runs this file in its own project, after the others finish.
import { test, expect } from '@playwright/test';

// The tests reset each other's state, so they must not run in parallel.
test.describe.configure({ mode: 'serial' });

test('reset clears sessions, orders and counters', async ({ request }) => {
  const login = await request.post('api/login', { data: { username: 'student', password: 'Password123!' } });
  const auth = { headers: { Authorization: `Bearer ${(await login.json()).token}` } };
  await request.post('api/cart/items', { ...auth, data: { productId: 12 } });
  await request.post('api/checkout', auth);
  expect((await (await request.get('api/_state')).json()).orders).toBeGreaterThan(0);

  const reset = await request.post('api/_reset');
  expect(reset.status()).toBe(200);
  expect(await reset.json()).toEqual({ reset: true });

  expect(await (await request.get('api/_state')).json()).toEqual({ sessions: 0, orders: 0, rateBuckets: 0, queues: {} });
  expect((await request.get('api/me', auth)).status()).toBe(401); // the old token is gone
});

test('after a reset the first order is ORD-1001 again', async ({ request }) => {
  await request.post('api/_reset');
  const login = await request.post('api/login', { data: { username: 'student', password: 'Password123!' } });
  const auth = { headers: { Authorization: `Bearer ${(await login.json()).token}` } };
  await request.post('api/cart/items', { ...auth, data: { productId: 12 } });
  expect((await (await request.post('api/checkout', auth)).json()).id).toBe('ORD-1001');
});

test('reset also clears rate-limit windows', async ({ request }) => {
  const url = 'api/limited?limit=1&window=60&key=reset-test';
  await request.post('api/_reset');
  expect((await request.get(url)).status()).toBe(200);
  expect((await request.get(url)).status()).toBe(429);
  await request.post('api/_reset');
  expect((await request.get(url)).status()).toBe(200);
});
