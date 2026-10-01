// Shared settings for every k6 script.
import { sleep } from 'k6';

/** Where the tests point. Defaults to the local practice server (npm run perf:server). */
export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:4180').replace(/\/+$/, '');

// Load testing a host you do not own is rude at best and against the terms of service at worst.
// That includes GitHub Pages (https://<user>.github.io), which is shared infrastructure.
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;
if (!LOCAL.test(BASE_URL) && __ENV.ALLOW_REMOTE !== '1') {
  throw new Error(
    `Refusing to run against ${BASE_URL}: only localhost is allowed. ` +
      'Start the practice server with `npm run perf:server`. If you really own the target, set ALLOW_REMOTE=1.',
  );
}

/** Full URL for an API or page path, for example url('/api/health'). */
export const url = (path: string): string => `${BASE_URL}${path}`;

/** A number from an environment variable (-e NAME=value), with a default. */
export function envNumber(name: string, fallback: number): number {
  const value = Number(__ENV[name]);
  return __ENV[name] !== undefined && __ENV[name] !== '' && Number.isFinite(value) ? value : fallback;
}

/**
 * Think time: the pause a real user takes between actions, a random number of seconds in [min, max].
 * Scale it with `-e THINK_TIME=0.5` (half as long) or `-e THINK_TIME=0` to remove it entirely.
 */
export function think(minSeconds: number, maxSeconds: number): void {
  sleep((minSeconds + Math.random() * (maxSeconds - minSeconds)) * envNumber('THINK_TIME', 1));
}
