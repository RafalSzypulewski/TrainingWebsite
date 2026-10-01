// One realistic user journey, reused by the load test: browse -> log in -> fill the cart -> check out.
import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { login } from './auth.ts';
import { think, url } from './config.ts';
import { users } from './data.ts';

// Custom metrics. They must be created in the init context (module top level), never inside default().
export const checkoutDuration = new Trend('checkout_duration', true); // `true` = values are milliseconds
export const ordersCreated = new Counter('orders_created');
export const journeySuccess = new Rate('journey_success');

const BROWSE_IDS = [1, 2, 5, 6, 12]; // in-stock products

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/** Runs the whole journey once for the current virtual user. Returns true when an order was placed. */
export function shopperJourney(): boolean {
  let placed = false;

  group('browse', () => {
    check(http.get(url('/index.html'), { tags: { name: 'GET /index.html', step: 'browse' } }), { 'home: status is 200': (r) => r.status === 200 });
    check(http.get(url('/api/products?size=12'), { tags: { name: 'GET /api/products', step: 'browse' } }), {
      'products: status is 200': (r) => r.status === 200,
    });
    think(0.2, 0.6);
    check(http.get(url(`/api/products/${pick(BROWSE_IDS)}`), { tags: { name: 'GET /api/products/:id', step: 'browse' } }), {
      'product: status is 200': (r) => r.status === 200,
    });
  });
  think(0.2, 0.6);

  // Each virtual user logs in as one of the demo accounts (VU numbers start at 1).
  const user = users[(__VU - 1) % users.length];
  const session = login(user.username, user.password);
  if (!session) {
    journeySuccess.add(false);
    return false;
  }

  group('shop', () => {
    const me = http.get(url('/api/me'), { headers: session.headers, tags: { name: 'GET /api/me', step: 'shop' } });
    check(me, { 'me: is the logged-in user': (r) => r.json('username') === user.username });

    for (const productId of [12, pick([5, 6])]) {
      const added = http.post(url('/api/cart/items'), JSON.stringify({ productId, qty: 1 }), {
        headers: session.headers,
        tags: { name: 'POST /api/cart/items', step: 'cart' },
      });
      check(added, { 'cart: item added (201)': (r) => r.status === 201 });
      think(0.2, 0.5);
    }

    const cart = http.get(url('/api/cart'), { headers: session.headers, tags: { name: 'GET /api/cart', step: 'cart' } });
    check(cart, { 'cart: has 2 items': (r) => (r.json('items') as unknown[]).length === 2 });
  });
  think(0.3, 0.8);

  group('checkout', () => {
    const res = http.post(url('/api/checkout'), null, { headers: session.headers, tags: { name: 'POST /api/checkout', step: 'checkout' } });
    placed = check(res, {
      'checkout: status is 201': (r) => r.status === 201,
      'checkout: has an order id': (r) => /^ORD-\d+$/.test(String(r.json('id'))),
    });
    checkoutDuration.add(res.timings.duration);
    if (placed) ordersCreated.add(1);
  });

  journeySuccess.add(placed);
  return placed;
}
