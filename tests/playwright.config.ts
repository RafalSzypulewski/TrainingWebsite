import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// BASE_URL=https://<user>.github.io/<repo>/ npm test   -> run against the deployed site
// (no BASE_URL)                                        -> serve the repo locally via `serve`
const external = process.env.BASE_URL;
// Trailing slash matters: tests use relative URLs like page.goto('pages/login.html').
const baseURL = (external ?? 'http://localhost:4173').replace(/\/?$/, '/');

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external
    ? undefined
    : {
        command: 'npx serve . -l 4173',
        cwd: path.resolve(__dirname, '..'),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
