// SOLUTION 5: closed model versus open model
//
// Default RATE of 8/s is below the capacity of 10/s: latency stays low and the test passes.
// Run it with  -e RATE=15  to push past capacity: the queue grows, response times climb with it,
// and the p95 threshold fails. The closed-model version hid exactly this.
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { envNumber, url } from '../lib/config.ts';

const RATE = envNumber('RATE', 8);

export const options: Options = {
  scenarios: {
    open: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 50,
      maxVUs: 150,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    dropped_iterations: ['count==0'],
  },
};

export default function (): void {
  const res = http.get(url('/api/queue?workers=1&ms=100&key=exercise5'), { tags: { name: 'GET /api/queue' } });
  check(res, { 'queue: status is 200': (r) => r.status === 200 });
}
