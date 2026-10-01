# Performance practice with k6

The site has matching pages (menu **Performance**: the lab and an API explorer). They find the API when you open them from
the practice server, `http://127.0.0.1:4180/pages/performance.html`, or when you add `?api=http://127.0.0.1:4180` to the address
of another local copy of the site.

New to this? Run `npm run perf:smoke`, then `npm run perf:load`, then work through [EXERCISES.md](EXERCISES.md).

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
npm run perf:smoke              # one user, a few checks: does everything work?
npm run perf:load               # 5 virtual users repeating a shopping journey, with thresholds
npm run perf:stress             # pushes a capacity-limited resource past its limit (expected to end red)
npm run perf:solutions          # every exercise solution, one after another
npm run perf -- <script> [k6 args]   # any script, e.g. perf/k6/exercises/01-thresholds.ts -e VUS=4
npm run perf:server             # start the server yourself (e.g. to try endpoints in a browser)
```

The runner starts the practice server if it is not already running, **resets its state before every script**, and
stops the server again if it started it. Arguments after the script name go to k6 (`--vus 3`, `-e NAME=value`).

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
| `POST /api/login` | JSON `{ username, password }` | `{ token, user }`; `401` wrong credentials, `423` locked account. Accounts: `assets/data/login-users.json` |
| `GET /api/me` | `Authorization: Bearer <token>` | the logged-in user; `401` without a valid token |
| `GET /api/cart` | token | items, `subtotal`, `shipping`, `total` (cents; shipping is free from 10 000) |
| `POST /api/cart/items` | token, JSON `{ productId, qty }` | `201` with the cart; `404` unknown product, `409` out of stock / over stock |
| `DELETE /api/cart/items/:productId` | token | the cart; `404` if not in the cart |
| `POST /api/checkout` | token | `201` with the order (`ORD-1001`, ...) and empties the cart; `400` if empty |
| `GET /api/orders` | token | the logged-in user's orders |
| `GET /api/limited` | `limit` (5), `window` seconds (10), `key` | fixed-window rate limit; `429` + `Retry-After` when exceeded. The key defaults to the token |
| `GET /api/queue` | `workers` (2), `ms` (200), `maxQueue` (500), `key` | limited capacity of `workers / ms` requests per second: later requests wait in line (`waitedMs` in the answer); `503` + `Retry-After` when the queue is full |
| `GET /api/_state` | | counts of sessions, orders, rate buckets and queue depths (diagnostics) |
| `POST /api/_reset` | | clears all of the above state |

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
| `perf/k6/smoke.ts`, `load.ts`, `stress.ts` | the three reference scripts (see [EXERCISES.md](EXERCISES.md)) |
| `perf/k6/lib/` | shared helpers: `config` (URLs, env settings, think time), `auth` (login), `data` (test users), `journey` (the shopping flow + custom metrics) |
| `perf/k6/exercises/`, `perf/k6/solutions/` | six exercises with `TODO`s and their worked solutions |
| `tests/perf-api/` | Playwright contract tests for the server (`npx playwright test --project=perf-api --project=perf-api-reset`) |

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
