// EXERCISE 3: test data and correlation
//
// Run it:  npm run perf -- perf/k6/exercises/03-data-and-correlation.ts
// It FAILS right now (the /api/me request is rejected). Fix the script.
//
// Goal
//   - every virtual user logs in as a DIFFERENT demo account, taken from the shared list in lib/data.ts
//   - the token from the login response is sent on the next request (correlation)
//   - a check proves /api/me returns the username of the user that logged in
//
// Hints
//   - `users[(__VU - 1) % users.length]` picks an account by virtual-user number
//   - lib/auth.ts has login(): it returns { token, headers } or null
//   - pass `{ headers: session.headers }` to http.get
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

export const options: Options = { vus: 2, iterations: 4, thresholds: { checks: ['rate==1'] } };

export default function (): void {
  // TODO: log in as the user chosen for this VU instead of always using "student"
  const res = http.post(url('/api/login'), JSON.stringify({ username: 'student', password: 'Password123!' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login: status is 200': (r) => r.status === 200 });

  // TODO: this request needs the token from the login response
  const me = http.get(url('/api/me'));
  check(me, { 'me: status is 200': (r) => r.status === 200 });
  // TODO: also check that me.json('username') is the user that logged in
}
