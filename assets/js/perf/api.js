/*
 * Shared by the Performance pages: where the practice API lives and whether it is reachable.
 *
 * The API (perf/server) only runs on a developer's machine, never on GitHub Pages. By default the pages
 * look for it on their own origin, which works when they are served by the practice server itself
 * (http://127.0.0.1:4180/pages/performance.html). To use it from another local server, for example
 * `npm start` on port 4173, add ?api=http://127.0.0.1:4180 to the URL. Only localhost is accepted.
 */
(function () {
  const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])$/;
  const LOCAL_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
  const TOKEN_KEY = 'pw_perf_token';

  const requested = (PW.param('api') ?? '').replace(/\/+$/, '');
  const apiParamRejected = requested !== '' && !LOCAL_ORIGIN.test(requested);
  const base = requested !== '' && !apiParamRejected ? requested : location.origin;
  const isLocalHost = LOCAL_HOST.test(location.hostname);

  // The practice server tags every file it serves with `Server-Timing: practice-api`. A page can read
  // that header from its own navigation entry, so it knows the API is on its own origin without
  // sending a request that would fail (and show up as a red error in the console) everywhere else.
  const onPracticeServer = (performance.getEntriesByType('navigation')[0]?.serverTiming ?? []).some((t) => t.name === 'practice-api');
  const canProbe = requested !== '' ? !apiParamRejected : onPracticeServer;

  const serverUrl = (path) => `http://127.0.0.1:4180${path}`;

  window.PerfApi = {
    base,
    canProbe,
    /** True when ?api= was given but is not a localhost address (it is ignored). */
    apiParamRejected,

    /** Is the practice API answering? */
    async isOnline() {
      if (!canProbe) return false;
      try {
        const res = await fetch(`${base}/api/health`, { cache: 'no-store' });
        return res.ok && (await res.json()).status === 'ok';
      } catch {
        return false;
      }
    },

    /** One sentence that tells the visitor why the API is not available and what to do about it. */
    offlineReason() {
      if (apiParamRejected) return 'The api parameter was ignored: it must point to localhost, for example ?api=http://127.0.0.1:4180.';
      if (requested !== '') return `Could not reach ${base}. Start the practice API with "npm run perf:server".`;
      if (!isLocalHost) return 'This site is hosted as static files, so the practice API is not available here. Run the repository locally to use it.';
      return `Start it with "npm run perf:server", then open ${serverUrl('/pages/performance.html')} or add ?api=${serverUrl('')} to this page's address.`;
    },

    /** The token of the user logged in on the explorer page (kept per browser tab). */
    getToken: () => sessionStorage.getItem(TOKEN_KEY),
    setToken(token) {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    },
  };
})();
