// SOLUTION 2: configuration from the command line, and a ramp
import http from 'k6/http';
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { envNumber, url } from '../lib/config.ts';

const VUS = envNumber('VUS', 3);
const DURATION = __ENV.DURATION || '8s';

export const options: Options = {
  scenarios: {
    ramped: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3s', target: VUS }, // ramp up
        { duration: DURATION, target: VUS }, // hold
        { duration: '2s', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'] },
};

export function setup(): void {
  console.log(`Running with ${VUS} VUs, holding for ${DURATION}`);
}

export default function (): void {
  http.get(url('/api/health'));
  sleep(0.5);
}
