// EXERCISE 5: closed model versus open model
//
// Run it:  npm run perf -- perf/k6/exercises/05-open-vs-closed.ts
//
// /api/queue?workers=1&ms=100 can serve 10 requests per second at most.
//
// This script uses 20 VUs that send the next request as soon as the previous one returns (a CLOSED
// model). Look at the result: the throughput stays near 10/s and the response time settles around
// 2 s. The system "protected itself" because the users slowed down together with the server.
//
// Goal: model what REAL users do, who keep arriving no matter how slow the site is.
//   - replace the scenario with a constant-arrival-rate executor: RATE (default 8) new requests/s for 10 s
//   - run it with the default rate, then with -e RATE=15 and compare latency and `dropped_iterations`
//
// Hints
//   - executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration, preAllocatedVUs, maxVUs
//   - the rate is requests STARTED per second; slow responses keep their VU busy longer, so you need
//     many more VUs (preAllocatedVUs: 50, maxVUs: 150 is plenty)
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

export const options: Options = {
  // TODO: replace `scenarios` with a constant-arrival-rate scenario driven by -e RATE
  scenarios: {
    closed: { executor: 'constant-vus', vus: 20, duration: '10s' },
  },
};

export default function (): void {
  const res = http.get(url('/api/queue?workers=1&ms=100&key=exercise5'), { tags: { name: 'GET /api/queue' } });
  check(res, { 'queue: status is 200': (r) => r.status === 200 });
}
