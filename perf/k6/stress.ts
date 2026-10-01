// Stress test: where does the system break, and HOW does it break?
// Run it with:  npm run perf:stress          (change the peak: npm run perf:stress -- -e PEAK_RATE=25)
//
// /api/queue is a resource with a fixed capacity: `workers` requests are served at once, each taking
// `ms`, everyone else waits in line. With the defaults (2 workers x 200 ms) the capacity is
// 2 / 0.2 s = 10 requests per second. We push 5 -> 16 requests per second and watch what happens
// once arrivals exceed capacity: the queue grows, and response times climb steadily.
//
// This script is MEANT to end with failed thresholds: the point is to see where they fail.
// Use an "open model" (arrival rate) so the load keeps coming even when the server slows down.
// A closed model (a fixed number of VUs) would back off by itself and hide the problem.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import { envNumber, url } from './lib/config.ts';

const WORKERS = envNumber('WORKERS', 2);
const SERVICE_MS = envNumber('SERVICE_MS', 200);
const PEAK_RATE = envNumber('PEAK_RATE', 16);
const CAPACITY = (WORKERS / SERVICE_MS) * 1000;

const queueWait = new Trend('queue_wait_ms', true); // time spent waiting in line, reported by the server

export const options: Options = {
  scenarios: {
    arrivals: {
      executor: 'ramping-arrival-rate', // start this many NEW requests per second, whatever the server does
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 120, // enough for the peak (rate x latency), so k6 does not lose time creating VUs mid-run
      maxVUs: 300, // slow responses keep VUs busy, so an open model needs many
      stages: [
        { duration: '8s', target: 6 }, // below capacity
        { duration: '12s', target: PEAK_RATE }, // crosses capacity on the way up
        { duration: '8s', target: PEAK_RATE }, // stays above it: the queue keeps growing
        { duration: '4s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    dropped_iterations: ['count==0'], // k6 could not start a request because it ran out of VUs
  },
};

export function setup(): void {
  console.log(`Capacity of the resource: ${CAPACITY} requests/s (${WORKERS} workers x ${SERVICE_MS} ms). Peak load: ${PEAK_RATE} requests/s.`);
}

export default function (): void {
  const res = http.get(url(`/api/queue?workers=${WORKERS}&ms=${SERVICE_MS}`), { tags: { name: 'GET /api/queue' } });
  const ok = check(res, { 'queue: status is 200': (r) => r.status === 200 });
  if (ok) queueWait.add(res.json('waitedMs') as number);
}
