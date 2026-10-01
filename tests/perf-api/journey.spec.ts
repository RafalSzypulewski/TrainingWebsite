// Contract tests for the stateful part of the practice API. Every test logs in for itself, so its
// session and cart are isolated from tests running in parallel. Order ids are global, so they are
// matched by pattern, never by exact value (the exact first id is checked in reset.spec.ts).
import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const STUDENT = { username: 'student', password: 'Password123!' };

async function login(request: APIRequestContext, credentials = STUDENT) {
  const response = await request.post('api/login', { data: credentials });
  expect(response.status()).toBe(200);
  const { token } = await response.json();
  return { headers: { Authorization: `Bearer ${token}` } };
}

test.describe('login and identity', () => {
  test('valid credentials return a token and the user', async ({ request }) => {
    const response = await request.post('api/login', { data: STUDENT });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(body.user).toEqual({ username: 'student', role: 'user' });
  });

  test('every login gets its own token', async ({ request }) => {
    const first = await (await request.post('api/login', { data: STUDENT })).json();
    const second = await (await request.post('api/login', { data: STUDENT })).json();
    expect(first.token).not.toBe(second.token);
  });

  test('admin has the admin role', async ({ request }) => {
    const auth = await login(request, { username: 'admin', password: 'Admin123!' });
    expect(await (await request.get('api/me', auth)).json()).toEqual({ username: 'admin', role: 'admin' });
  });

  test('wrong password, unknown user, locked account and malformed body', async ({ request }) => {
    expect((await request.post('api/login', { data: { username: 'student', password: 'nope' } })).status()).toBe(401);
    expect((await request.post('api/login', { data: { username: 'ghost', password: 'x' } })).status()).toBe(401);
    expect((await request.post('api/login', { data: {} })).status()).toBe(401);
    const locked = await request.post('api/login', { data: { username: 'locked', password: 'Locked123!' } });
    expect(locked.status()).toBe(423);
    expect(await locked.json()).toEqual({ error: 'This account is locked' });
    const malformed = await request.post('api/login', { data: '{not json', headers: { 'Content-Type': 'application/json' } });
    expect(malformed.status()).toBe(400);
  });

  test('/api/me needs a valid token', async ({ request }) => {
    expect((await request.get('api/me')).status()).toBe(401);
    expect((await request.get('api/me', { headers: { Authorization: 'Bearer made-up' } })).status()).toBe(401);
    expect((await request.get('api/me', { headers: { Authorization: 'Basic abc' } })).status()).toBe(401);
    const auth = await login(request);
    expect(await (await request.get('api/me', auth)).json()).toEqual({ username: 'student', role: 'user' });
  });
});

test.describe('cart', () => {
  test('all cart endpoints require a token', async ({ request }) => {
    expect((await request.get('api/cart')).status()).toBe(401);
    expect((await request.post('api/cart/items', { data: { productId: 1 } })).status()).toBe(401);
    expect((await request.delete('api/cart/items/1')).status()).toBe(401);
    expect((await request.post('api/checkout')).status()).toBe(401);
    expect((await request.get('api/orders')).status()).toBe(401);
  });

  test('starts empty', async ({ request }) => {
    const auth = await login(request);
    expect(await (await request.get('api/cart', auth)).json()).toEqual({ items: [], subtotal: 0, shipping: 0, total: 0 });
  });

  test('adding items computes line totals, subtotal, shipping and total', async ({ request }) => {
    const auth = await login(request);
    await request.post('api/cart/items', { ...auth, data: { productId: 12, qty: 1 } }); // Ceramic Mug $12.50
    const added = await request.post('api/cart/items', { ...auth, data: { productId: 5 } }); // Clean Code $39.90, qty defaults to 1
    expect(added.status()).toBe(201);
    const cart = await added.json();
    expect(cart.items).toEqual([
      { productId: 12, name: 'Ceramic Mug', qty: 1, unitPrice: 1250, lineTotal: 1250 },
      { productId: 5, name: 'Clean Code', qty: 1, unitPrice: 3990, lineTotal: 3990 },
    ]);
    expect(cart).toMatchObject({ subtotal: 5240, shipping: 599, total: 5839 });
  });

  test('adding the same product again increases its quantity', async ({ request }) => {
    const auth = await login(request);
    await request.post('api/cart/items', { ...auth, data: { productId: 12, qty: 2 } });
    const cart = await (await request.post('api/cart/items', { ...auth, data: { productId: 12, qty: 3 } })).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ qty: 5, lineTotal: 6250 });
  });

  test('shipping is free from $100.00', async ({ request }) => {
    const auth = await login(request);
    const cart = await (await request.post('api/cart/items', { ...auth, data: { productId: 2 } })).json(); // $129.00
    expect(cart).toMatchObject({ subtotal: 12900, shipping: 0, total: 12900 });
  });

  test('stock limits and validation', async ({ request }) => {
    const auth = await login(request);
    const add = (data: object) => request.post('api/cart/items', { ...auth, data });

    expect((await add({ productId: 3 })).status()).toBe(409); // out of stock
    expect((await add({ productId: 999 })).status()).toBe(404);
    expect((await add({ productId: 4, qty: 4 })).status()).toBe(409); // Smart Watch has 3 in stock
    expect((await add({ productId: 4, qty: 3 })).status()).toBe(201);
    const over = await add({ productId: 4, qty: 1 });
    expect(over.status()).toBe(409);
    expect(await over.json()).toEqual({ error: 'Only 3 in stock' });

    for (const bad of [{}, { productId: 'x' }, { productId: 1, qty: 0 }, { productId: 1, qty: 1.5 }, { productId: -2 }]) {
      expect((await add(bad)).status(), JSON.stringify(bad)).toBe(400);
    }
  });

  test('removing an item', async ({ request }) => {
    const auth = await login(request);
    await request.post('api/cart/items', { ...auth, data: { productId: 12 } });
    await request.post('api/cart/items', { ...auth, data: { productId: 5 } });

    const removed = await request.delete('api/cart/items/12', auth);
    expect(removed.status()).toBe(200);
    expect((await removed.json()).items.map((i: { productId: number }) => i.productId)).toEqual([5]);
    expect((await request.delete('api/cart/items/12', auth)).status()).toBe(404);
  });

  test('carts of different sessions are separate', async ({ request }) => {
    const alice = await login(request);
    const bob = await login(request);
    await request.post('api/cart/items', { ...alice, data: { productId: 12 } });
    expect((await (await request.get('api/cart', alice)).json()).items).toHaveLength(1);
    expect((await (await request.get('api/cart', bob)).json()).items).toHaveLength(0);
  });
});

test.describe('checkout and orders', () => {
  test('checkout turns the cart into an order and empties the cart', async ({ request }) => {
    const auth = await login(request);
    await request.post('api/cart/items', { ...auth, data: { productId: 12, qty: 2 } });

    const response = await request.post('api/checkout', auth);
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.id).toMatch(/^ORD-\d{4,}$/);
    expect(order).toMatchObject({ username: 'student', subtotal: 2500, shipping: 599, total: 3099 });

    expect((await (await request.get('api/cart', auth)).json()).items).toEqual([]);
    const { orders } = await (await request.get('api/orders', auth)).json();
    expect(orders.map((o: { id: string }) => o.id)).toContain(order.id);
  });

  test('checkout with an empty cart is rejected', async ({ request }) => {
    const auth = await login(request);
    const response = await request.post('api/checkout', auth);
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Cart is empty' });
  });

  test('order ids increase', async ({ request }) => {
    const auth = await login(request);
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      await request.post('api/cart/items', { ...auth, data: { productId: 12 } });
      ids.push(Number((await (await request.post('api/checkout', auth)).json()).id.slice(4)));
    }
    expect(ids[1]).toBeGreaterThan(ids[0]);
  });

  test('a user only sees their own orders', async ({ request }) => {
    const student = await login(request);
    const admin = await login(request, { username: 'admin', password: 'Admin123!' });
    await request.post('api/cart/items', { ...student, data: { productId: 12 } });
    const { id } = await (await request.post('api/checkout', student)).json();

    const adminOrders = (await (await request.get('api/orders', admin)).json()).orders;
    expect(adminOrders.map((o: { id: string }) => o.id)).not.toContain(id);
  });
});
