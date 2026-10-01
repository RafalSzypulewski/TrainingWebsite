# Performance practice with k6

A small, local-only playground for learning performance testing. It is **not** part of the published site:
GitHub Pages only serves static files, so the API below runs on your machine.

```text
k6 scripts (perf/k6/*.ts)  --HTTP-->  practice server (http://127.0.0.1:4180)
                                       |- the site's static files (what GitHub Pages publishes)
                                       `- /api/*  behaviour you control with query parameters
```

## Setup

1. Install k6 (v1.0 or newer, it runs TypeScript directly):
   - Windows: `winget install GrafanaLabs.k6`
   - macOS: `brew install k6`
   - Linux / Docker: https://grafana.com/docs/k6/latest/set-up/install-k6/
2. `npm install` (adds `@types/k6` for editor support and type-checking).

## Run

```bash
npm run perf:smoke              # starts the practice server if needed, runs the script, stops it
npm run perf:smoke -- --vus 3   # extra arguments go to k6
npm run perf:server             # start the server yourself (e.g. to try endpoints in a browser)
```

A script **fails** (non-zero exit code, `99` for thresholds) when a threshold or check is broken, which is exactly
what makes it usable in CI.

## The practice API

All parameters are validated; bad values return `400` with `{ "error": "..." }`.

| Endpoint | Parameters | Behaviour |
| --- | --- | --- |
| `GET /api/health` | | `{ status, uptimeSeconds, requests }` |
| `GET /api/products` | `page`, `size` (1-50), `q`, `category` | paginated list from `assets/data/products.json` |
| `GET /api/products/:id` | | one product, `404` if unknown |
| `GET /api/slow` | `ms` (default 300), `jitter` | waits `ms` plus up to `jitter` ms (total at most 10 000) |
| `GET /api/flaky` | `rate` (0-1, default 0.2) | fails that share of requests with `500` |
| `GET /api/status/:code` | | answers with that status code (200-599) |
| `GET /api/payload` | `kb` (0-5120), `gzip=1` | response of that size, optionally gzip-compressed |

### Reproducible randomness

`slow`, `flaky` and `payload` accept `seed` (and `slow`/`flaky` also `i`). The outcome depends only on
`(seed, i)`, never on request order, so parallel virtual users get repeatable results:

```ts
http.get(url(`/api/flaky?rate=0.3&seed=1&i=${__ITER}`)); // the same iterations fail on every run
```

Without `seed` the values are truly random.

## Files

| Path | What |
| --- | --- |
| `perf/server/server.js` | the practice server (Node built-ins only) |
| `perf/run.js` | starts the server if needed, runs one k6 script, stops the server |
| `perf/k6/lib/config.ts` | `BASE_URL`, `url()` and the "localhost only" guard |
| `perf/k6/smoke.ts` | the first script: one user, a few checks, three thresholds |
| `tests/perf-api/` | Playwright contract tests for the server (`npx playwright test --project=perf-api`) |

## Safety rules

- The server listens on `127.0.0.1` only, with hard limits on delay and payload size.
- **Never point k6 at `github.io` or any host you do not own.** The scripts refuse non-local URLs unless you set
  `ALLOW_REMOTE=1`, and CI never runs k6 against the deployed site.
- Do not compare numbers between machines: they only mean something relative to each other on the same machine.

## Vocabulary

- **VU** (virtual user): one simulated user running your script in a loop.
- **Iteration**: one run of the default function.
- **Check**: an assertion that is counted, but does not stop the test.
- **Threshold**: a pass/fail rule on a metric, for example `http_req_duration: ['p(95)<500']`.
- **p95**: 95% of requests were faster than this value. Averages hide slow outliers, percentiles do not.
- **Think time**: the pause between a user's actions (`sleep`). Without it the load is unrealistically harsh.
