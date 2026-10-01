// Smoke test: does everything work at all, for one user, quickly?
// Run it with:  npm run perf:smoke        (starts the practice server for you)
//
// A smoke test is not about load. It proves the target is up and the script itself is correct
// before you spend time on heavier tests.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import type { Options } from 'k6/options';
import { url } from './lib/config.ts';

export const options: Options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    // The run FAILS (non-zero exit code) if any of these are broken.
    http_req_failed: ['rate<0.01'], // fewer than 1% of requests may fail
    http_req_duration: ['p(95)<500'], // 95% of requests must finish within 500 ms
    checks: ['rate==1'], // every check() must pass
  },
};

export default function (): void {
  group('site', () => {
    const home = http.get(url('/index.html'));
    check(home, {
      'home: status is 200': (r) => r.status === 200,
      'home: has the title': (r) => String(r.body).includes('Playwright Practice Lab'),
    });

    const login = http.get(url('/pages/login.html'));
    check(login, { 'login page: status is 200': (r) => r.status === 200 });
  });

  group('api', () => {
    const health = http.get(url('/api/health'));
    check(health, {
      'health: status is 200': (r) => r.status === 200,
      'health: says ok': (r) => r.json('status') === 'ok',
    });

    const products = http.get(url('/api/products?page=1&size=5'));
    check(products, {
      'products: status is 200': (r) => r.status === 200,
      'products: returns 5 items': (r) => (r.json('items') as unknown[]).length === 5,
    });

    // The `name` tag groups all product ids into ONE series in the results. Without it, every
    // distinct URL becomes its own series (a classic k6 mistake that bloats the output).
    const product = http.get(url('/api/products/1'), { tags: { name: 'GET /api/products/:id' } });
    check(product, { 'product: is Wireless Headphones': (r) => r.json('name') === 'Wireless Headphones' });

    const slow = http.get(url('/api/slow?ms=100'));
    check(slow, {
      'slow: status is 200': (r) => r.status === 200,
      // Never assert an exact lower bound on a timer-based duration: the server's timer can fire a few
      // milliseconds early (more on a busy CI machine), so 100 ms of delay can be measured as 99.x ms.
      // The server's own report of the delay is exact, the measured time only needs to be roughly right.
      'slow: server applied the 100 ms delay': (r) => r.json('delayMs') === 100,
      'slow: took about 100 ms or more': (r) => r.timings.duration >= 90,
    });
  });

  sleep(0.3); // "think time": a real user does not fire requests back to back
}
