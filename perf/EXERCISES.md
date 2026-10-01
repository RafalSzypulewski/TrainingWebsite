# k6 exercises

Six exercises, each a short script with `TODO`s. Open the starter, read the goal and hints at the top, change
the script until it does what the goal says, and compare with the solution only when you are stuck.

```bash
npm run perf -- perf/k6/exercises/01-thresholds.ts              # run a starter (the server starts itself)
npm run perf -- perf/k6/solutions/01-thresholds.ts              # run the solution
npm run perf -- perf/k6/exercises/05-open-vs-closed.ts -e RATE=15   # pass settings to the script with -e
npm run perf:solutions                                          # all solutions, one after another
```

The runner resets the server's state (sessions, carts, rate limits, queues) before every script, so each run
starts clean.

| # | File | Starter today | You learn |
| --- | --- | --- | --- |
| 1 | `01-thresholds.ts` | **fails** | tags, thresholds on one series (`metric{tag:value}`) |
| 2 | `02-configuration.ts` | runs, incomplete | `-e` settings, `__ENV`, ramping stages, `setup()` |
| 3 | `03-data-and-correlation.ts` | **fails** | `SharedArray` test data, one account per VU, passing a token between requests |
| 4 | `04-custom-metrics.ts` | runs, incomplete | `Trend`, `Counter`, `Rate`, thresholds on your own metrics |
| 5 | `05-open-vs-closed.ts` | runs, incomplete | closed (VUs) versus open (arrival rate) load models, and why the difference matters |
| 6 | `06-resilience.ts` | **fails** | honouring `429` + `Retry-After`, retrying a flaky service |

A starter that "fails" exits with code 99 (a threshold) because the script is wrong, which is the exercise.

## Reading the output

- `checks` are assertions that are counted, not fatal. `thresholds` decide whether the **run** passes.
- `http_req_duration` has `avg`, `med`, `p(90)`, `p(95)`, `max`. Look at percentiles, not the average.
- `iterations` and `http_reqs` per second tell you the achieved **throughput**.
- `dropped_iterations` (open models only) means k6 could not start requests fast enough: a sign of
  overload, or of too few VUs.

## The scripts you can learn from

| Script | Shows |
| --- | --- |
| `smoke.ts` | the minimum a useful test has: checks, thresholds, tags, think time |
| `load.ts` | a realistic multi-step journey with ramping VUs and per-step thresholds (`lib/journey.ts`) |
| `stress.ts` | pushing an open-model load past a capacity limit and watching latency climb |

Try changing them: `npm run perf:load -- -e VUS=15`, `npm run perf:stress -- -e PEAK_RATE=25 -e WORKERS=4`.

## Stretch ideas (no starter files)

1. **Spike test:** jump from 2 to 40 requests per second in two seconds and back down (`ramping-arrival-rate`).
   Does the queue recover, and how long does it take?
2. **Soak test:** run `load.ts` at low load for ten minutes. What would you watch for? (Memory, error creep.)
3. **Compression:** compare `/api/payload?kb=500&gzip=0` with `gzip=1`. Look at `http_req_receiving` and
   `data_received`. Which is faster on localhost, and would that hold on a slow network?
4. **Fail fast:** add `abortOnFail: true` to a threshold, with `delayAbortEval: '5s'`, so a clearly broken
   run stops early.
5. **Per-VU rate limits:** give each VU its own bucket with `key=vu-${__VU}` on `/api/limited`.
6. **Find the capacity:** keep raising `PEAK_RATE` in `stress.ts` until `dropped_iterations` appears. Does
   that match `workers / ms` from the formula in the script's header comment?
