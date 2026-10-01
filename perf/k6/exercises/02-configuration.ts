// EXERCISE 2: configuration from the command line, and a ramp
//
// Run it:  npm run perf -- perf/k6/exercises/02-configuration.ts
// Try also: npm run perf -- perf/k6/exercises/02-configuration.ts -e VUS=4 -e DURATION=6s
//
// Goal
//   - VUS (default 3) and DURATION (default '8s') come from environment variables (-e NAME=value)
//   - the users ramp up over 3 s and ramp down over 2 s instead of all starting at once
//   - the script prints how many VUs it runs with
//
// Hints
//   - `__ENV.VUS` is a string or undefined: convert it, and fall back to the default
//     (lib/config.ts has a helper: envNumber)
//   - a `ramping-vus` executor takes `stages: [{ duration, target }, ...]`
//   - console.log in setup() runs once, before the test
import http from 'k6/http';
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

// TODO: read VUS and DURATION from the environment
export const options: Options = {
  vus: 1,
  duration: '5s',
};

export default function (): void {
  http.get(url('/api/health'));
  sleep(0.5);
}
