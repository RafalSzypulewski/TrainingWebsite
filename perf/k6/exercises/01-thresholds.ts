// EXERCISE 1: thresholds for one endpoint
//
// Run it:  npm run perf -- perf/k6/exercises/01-thresholds.ts
// It FAILS right now. Find out why, then fix the script (not the server).
//
// Goal
//   - the run must fail if /api/products gets slower than 200 ms at p95
//   - it must NOT fail just because /api/slow is slow (it is slow on purpose)
//
// Hints
//   - a threshold on `http_req_duration` looks at ALL requests together
//   - tag each request (`tags: { name: '...' }`) and select a series: 'http_req_duration{name:products}'
//   - prove that it works: temporarily lower the products limit to 'p(95)<0.1' and check that the run
//     now fails because of /api/products, and not because of /api/slow
import http from 'k6/http';
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 2,
  duration: '8s',
  thresholds: {
    // TODO: replace this single global threshold with one per endpoint
    http_req_duration: ['p(95)<200'],
  },
};

export default function (): void {
  http.get(url('/api/products?size=5')); // TODO: tag this request
  http.get(url('/api/slow?ms=400')); // slow on purpose: TODO tag this one too
  sleep(0.2);
}
