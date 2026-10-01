// Tests for perf/explain.js, which turns a k6 summary export into reasons a run failed.
// A pure function: no server and no browser involved.
import { test, expect } from '@playwright/test';
import { describe, explain } from '../../perf/explain';

// In k6's exported summary, `thresholds: { rule: true }` means the rule was CROSSED (failed).
const summary = {
  metrics: {
    checks: { passes: 90, fails: 10, value: 0.9, thresholds: { 'rate==1': true } },
    http_req_failed: { passes: 0, fails: 100, value: 0, thresholds: { 'rate<0.01': false } },
    http_req_duration: { avg: 40, 'p(95)': 612.349, max: 700, thresholds: { 'p(95)<500': true, 'max<5000': false } },
    iterations: { count: 10, rate: 2 }, // no thresholds at all
  },
  root_group: {
    checks: { a: { name: 'top level ok', passes: 10, fails: 0 } },
    groups: {
      api: {
        checks: { b: { name: 'slow: took about 100 ms or more', passes: 9, fails: 1 } },
        groups: { nested: { checks: { c: { name: 'deep check', passes: 0, fails: 4 } } } },
      },
    },
  },
};

test('finds crossed thresholds, with the observed value', () => {
  expect(explain(summary).thresholds).toEqual([
    { metric: 'checks', rule: 'rate==1', observed: 'rate=0.9' },
    { metric: 'http_req_duration', rule: 'p(95)<500', observed: 'p(95)=612.35' },
  ]);
});

test('finds failed checks in nested groups and ignores passing ones', () => {
  expect(explain(summary).checks).toEqual([
    { name: 'slow: took about 100 ms or more', passes: 9, fails: 1 },
    { name: 'deep check', passes: 0, fails: 4 },
  ]);
});

test('describes every problem in one line each', () => {
  expect(describe(explain(summary))).toEqual([
    'threshold crossed: checks rate==1 (observed rate=0.9)',
    'threshold crossed: http_req_duration p(95)<500 (observed p(95)=612.35)',
    'check failed: "slow: took about 100 ms or more" (9 passed, 1 failed)',
    'check failed: "deep check" (0 passed, 4 failed)',
  ]);
});

test('a clean summary has nothing to explain', () => {
  const clean = { metrics: { checks: { value: 1, thresholds: { 'rate==1': false } } }, root_group: { checks: { a: { name: 'ok', passes: 5, fails: 0 } } } };
  expect(explain(clean)).toEqual({ thresholds: [], checks: [] });
  expect(describe(explain(clean))).toEqual([]);
});

test('missing or odd input does not throw', () => {
  expect(explain({})).toEqual({ thresholds: [], checks: [] });
  expect(explain({ metrics: { x: {} } })).toEqual({ thresholds: [], checks: [] });
});
