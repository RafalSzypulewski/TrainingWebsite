// SOLUTION 6: rate limits and flaky services
import http from 'k6/http';
import { check, sleep } from 'k6';
import type { Options } from 'k6/options';
import type { RefinedResponse, ResponseType } from 'k6/http';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

type Response = RefinedResponse<ResponseType | undefined>;

/**
 * GET that behaves like a well-mannered client: on 429 it waits for the time the server asked for
 * (Retry-After), on 5xx it tries again straight away, and it gives up after `maxAttempts`.
 */
function getWithRetry(target: string, maxAttempts: number): Response {
  let res = http.get(target);
  for (let attempt = 1; attempt < maxAttempts && res.status !== 200; attempt++) {
    if (res.status === 429) sleep(Number(res.headers['Retry-After'] ?? 1));
    res = http.get(target);
  }
  return res;
}

export default function (): void {
  for (let i = 1; i <= 5; i++) {
    const res = getWithRetry(url('/api/limited?limit=3&window=3&key=exercise6'), 3);
    check(res, { [`limited request ${i}: status is 200`]: (r) => r.status === 200 });
  }

  for (let i = 0; i < 4; i++) {
    // Each attempt must use a new `i`, otherwise the seeded failure would repeat on every retry.
    let res = http.get(url(`/api/flaky?rate=0.5&seed=1&i=${i * 10}`));
    for (let attempt = 1; attempt < 3 && res.status !== 200; attempt++) {
      res = http.get(url(`/api/flaky?rate=0.5&seed=1&i=${i * 10 + attempt}`));
    }
    check(res, { [`flaky call ${i}: eventually succeeds`]: (r) => r.status === 200 });
  }
}
