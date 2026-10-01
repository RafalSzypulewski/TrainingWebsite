// EXERCISE 6: rate limits and flaky services
//
// Run it:  npm run perf -- perf/k6/exercises/06-resilience.ts
// It FAILS right now. Make the client behave like a well-mannered one.
//
// Goal
//   - /api/limited allows 3 requests per 3 s window. The script sends 5 in a row. When the answer is
//     429, wait for the number of seconds in the `Retry-After` header and try again (at most 2 retries)
//   - /api/flaky fails about half of the requests with 500. Retry up to 3 times in total, and
//     check that the call eventually succeeded
//
// Hints
//   - res.headers['Retry-After'] is a string; sleep(Number(...))
//   - write a small helper such as getWithRetry(url, maxAttempts) and use it for both endpoints
//   - ?seed= and ?i= make /api/flaky repeatable. Careful: a retry with the SAME i fails the same way
//     again, so give every attempt its own i
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function (): void {
  for (let i = 1; i <= 5; i++) {
    // TODO: on 429, sleep for Retry-After seconds and retry
    const res = http.get(url('/api/limited?limit=3&window=3&key=exercise6'));
    check(res, { [`limited request ${i}: status is 200`]: (r) => r.status === 200 });
  }

  for (let i = 0; i < 4; i++) {
    // TODO: retry up to 3 attempts in total
    const res = http.get(url(`/api/flaky?rate=0.5&seed=1&i=${i}`));
    check(res, { [`flaky call ${i}: eventually succeeds`]: (r) => r.status === 200 });
  }
}
