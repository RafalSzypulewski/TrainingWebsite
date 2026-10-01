import http from 'k6/http';
import { check } from 'k6';
import { url } from './config.ts';

export interface Session {
  token: string;
  /** Headers to send on every authenticated request. */
  headers: { Authorization: string; 'Content-Type': string };
}

/** Logs in and returns the session, or null when the login failed (the failed checks are recorded). */
export function login(username: string, password: string): Session | null {
  const res = http.post(url('/api/login'), JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/login', step: 'login' },
  });
  const ok = check(res, {
    'login: status is 200': (r) => r.status === 200,
    'login: response has a token': (r) => typeof r.json('token') === 'string',
  });
  if (!ok) return null;

  // Correlation: a value from one response (the token) is needed in all following requests.
  const token = res.json('token') as string;
  return { token, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}
