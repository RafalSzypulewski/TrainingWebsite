// SOLUTION 4: custom metrics
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import { login } from '../lib/auth.ts';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 2,
  iterations: 6,
  thresholds: {
    checks: ['rate==1'],
    checkout_duration: ['p(95)<500'],
    order_success: ['rate>0.99'],
    orders_created: ['count>0'],
  },
};

// Created once, in the init context, and shared by all iterations.
const checkoutDuration = new Trend('checkout_duration', true);
const ordersCreated = new Counter('orders_created');
const orderSuccess = new Rate('order_success');

export default function (): void {
  const session = login('student', 'Password123!');
  if (!session) {
    orderSuccess.add(false);
    return;
  }

  http.post(url('/api/cart/items'), JSON.stringify({ productId: 12, qty: 1 }), { headers: session.headers });
  const checkout = http.post(url('/api/checkout'), null, { headers: session.headers });
  const ok = check(checkout, { 'checkout: status is 201': (r) => r.status === 201 });

  checkoutDuration.add(checkout.timings.duration);
  orderSuccess.add(ok);
  if (ok) ordersCreated.add(1);
}
