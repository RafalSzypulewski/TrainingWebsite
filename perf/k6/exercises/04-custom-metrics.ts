// EXERCISE 4: custom metrics
//
// Run it:  npm run perf -- perf/k6/exercises/04-custom-metrics.ts
//
// Goal: measure the business flow, not just HTTP requests.
//   - Trend  `checkout_duration`  the time of the checkout request
//   - Counter `orders_created`    how many orders were placed
//   - Rate   `order_success`      the share of iterations that placed an order
//   - thresholds: checkout_duration p(95)<500, order_success rate>0.99, orders_created count>0
//
// Hints
//   - create metrics at the top of the file (init context), add values inside default()
//   - `new Trend('name', true)`: the `true` tells k6 the values are times
//   - `trend.add(res.timings.duration)`, `counter.add(1)`, `rate.add(true | false)`
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { login } from '../lib/auth.ts';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 2,
  iterations: 6,
  thresholds: {
    // TODO: add thresholds for your custom metrics
    checks: ['rate==1'],
  },
};

// TODO: create the three metrics here

export default function (): void {
  const session = login('student', 'Password123!');
  if (!session) return;

  http.post(url('/api/cart/items'), JSON.stringify({ productId: 12, qty: 1 }), { headers: session.headers });
  const checkout = http.post(url('/api/checkout'), null, { headers: session.headers });
  check(checkout, { 'checkout: status is 201': (r) => r.status === 201 });

  // TODO: record the metrics
}
