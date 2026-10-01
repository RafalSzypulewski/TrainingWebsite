'use strict';
/*
 * Turns a k6 summary export (k6 run --summary-export=file.json) into a short explanation of why a
 * run failed: which thresholds were crossed and which checks failed. k6 prints a long report, and in
 * CI the reason for a red run is easy to miss in it.
 */
const fs = require('node:fs');

/** In the exported file `thresholds: { "p(95)<500": true }` means the threshold was CROSSED (failed). */
function observedValue(data, rule) {
  const stat = /^[\w()]+/.exec(rule)?.[0];
  const value = stat === 'rate' ? data.value : data[stat];
  return typeof value === 'number' ? `${stat}=${Math.round(value * 100) / 100}` : null;
}

/** @returns {{ thresholds: {metric: string, rule: string, observed: string|null}[], checks: {name: string, passes: number, fails: number}[] }} */
function explain(summary) {
  const thresholds = [];
  for (const [metric, data] of Object.entries(summary.metrics ?? {})) {
    for (const [rule, crossed] of Object.entries(data.thresholds ?? {})) {
      if (crossed) thresholds.push({ metric, rule, observed: observedValue(data, rule) });
    }
  }

  const checks = [];
  (function walk(group) {
    for (const check of Object.values(group.checks ?? {})) {
      if (check.fails > 0) checks.push({ name: check.name, passes: check.passes, fails: check.fails });
    }
    for (const child of Object.values(group.groups ?? {})) walk(child);
  })(summary.root_group ?? {});

  return { thresholds, checks };
}

/** One human-readable line per problem. */
function describe({ thresholds, checks }) {
  return [
    ...thresholds.map((t) => `threshold crossed: ${t.metric} ${t.rule}${t.observed ? ` (observed ${t.observed})` : ''}`),
    ...checks.map((c) => `check failed: "${c.name}" (${c.passes} passed, ${c.fails} failed)`),
  ];
}

/** Reads an exported summary; null when the file is missing or not valid JSON. */
function explainFile(file) {
  try {
    return explain(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

module.exports = { explain, describe, explainFile };
