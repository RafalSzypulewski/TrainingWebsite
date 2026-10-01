import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// BASE_URL=https://<user>.github.io/<repo>/ npm test   -> run against the deployed site
// (no BASE_URL)                                        -> serve the repo locally via `serve`
// An empty BASE_URL (e.g. unset workflow input) must count as "not set".
const external = process.env.BASE_URL?.trim() || undefined;
// Trailing slash matters: tests use relative URLs like page.goto('pages/login.html').
const baseURL = (external ?? 'http://localhost:4173').replace(/\/?$/, '/');
const root = path.resolve(__dirname, '..');

// The practice API for k6 (perf/server) only exists locally, never on GitHub Pages.
const perfURL = 'http://127.0.0.1:4180/';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 'github' adds failure and flaky-test annotations to the workflow run.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', testIgnore: '**/perf-api/**', use: { ...devices['Desktop Chrome'] } },
    // API contract tests for the practice server: no browser, plain HTTP requests.
    ...(external
      ? []
      : [
          { name: 'perf-api', testMatch: '**/perf-api/**/*.spec.ts', testIgnore: '**/perf-api/reset.spec.ts', use: { baseURL: perfURL } },
          // _reset wipes the whole server, so it must run alone, after everything else has finished.
          { name: 'perf-api-reset', testMatch: '**/perf-api/reset.spec.ts', dependencies: ['perf-api'], use: { baseURL: perfURL } },
        ]),
  ],
  webServer: external
    ? undefined
    : [
        { command: 'npx serve . -l 4173', cwd: root, url: baseURL, reuseExistingServer: !process.env.CI },
        { command: 'node perf/server/server.js', cwd: root, url: `${perfURL}api/health`, reuseExistingServer: !process.env.CI },
      ],
});
