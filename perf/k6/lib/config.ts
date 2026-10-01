// Shared settings for every k6 script.

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
