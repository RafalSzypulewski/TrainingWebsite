// Load test: how does the system behave under the load we EXPECT in normal use?
// Run it with:  npm run perf:load            (more users: npm run perf:load -- -e VUS=15)
//
// Each virtual user repeats the full shopping journey (see lib/journey.ts) with think time between
// steps. This is a "closed model": a user only starts the next journey when the previous one is done.
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { envNumber } from './lib/config.ts';
import { shopperJourney } from './lib/journey.ts';

const VUS = envNumber('VUS', 5);

export const options: Options = {
  scenarios: {
    shoppers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '8s', target: VUS }, // ramp up: do not start everyone at once
        { duration: '20s', target: VUS }, // steady state: this is the part you measure
        { duration: '4s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'], // all requests together
    'http_req_duration{step:checkout}': ['p(95)<500'], // one step, selected with the `step` tag
    checks: ['rate>0.99'],
    journey_success: ['rate>0.99'], // custom Rate metric from lib/journey.ts
    orders_created: ['count>0'], // custom Counter: the test must actually have placed orders
  },
};

export default function (): void {
  shopperJourney();
  sleep(1); // pause before this user starts over
}
