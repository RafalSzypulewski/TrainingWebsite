// SOLUTION 3: test data and correlation
import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import { login } from '../lib/auth.ts';
import { url } from '../lib/config.ts';
import { users } from '../lib/data.ts';

export const options: Options = { vus: 2, iterations: 4, thresholds: { checks: ['rate==1'] } };

export default function (): void {
  const user = users[(__VU - 1) % users.length]; // VU 1 -> first account, VU 2 -> second, ...
  const session = login(user.username, user.password);
  if (!session) return; // login() already recorded the failed checks

  const me = http.get(url('/api/me'), { headers: session.headers }); // correlation: reuse the token
  check(me, {
    'me: status is 200': (r) => r.status === 200,
    'me: is the user that logged in': (r) => r.json('username') === user.username,
  });
}
