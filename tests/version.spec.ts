import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const readJSON = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test.describe('Site version', () => {
  test('version.json and package.json agree', () => {
    expect(readJSON('assets/data/version.json').version).toBe(readJSON('package.json').version);
  });

  for (const page of ['index.html', 'pages/login.html', 'pages/shop.html', 'pages/tricky.html']) {
    test(`footer shows the version on ${page}`, async ({ page: p }) => {
      await p.goto(page);
      const version = p.getByRole('contentinfo').getByTestId('site-version');
      await expect(version).toBeVisible();
      // "v1.0.0" locally; the deployed site appends " · <commit> · built <date>".
      await expect(version).toHaveText(new RegExp(`^v${readJSON('package.json').version.replace(/\./g, '\\.')}( · [0-9a-f]{7} · built \\d{4}-\\d{2}-\\d{2})?$`));
    });
  }

  test('the page still works when version info is unavailable', async ({ page }) => {
    await page.route('**/assets/data/version.json*', (route) => route.fulfill({ status: 404 }));
    await page.goto('index.html');
    await expect(page.getByTestId('site-version')).toBeHidden();
    await expect(page.getByTestId('reset-data')).toBeVisible();
  });

  test('commit and build date are shown when present', async ({ page }) => {
    await page.route('**/assets/data/version.json*', (route) =>
      route.fulfill({ json: { version: '2.3.4', commit: 'abc1234', built: '2026-01-02' } }));
    await page.goto('index.html');
    await expect(page.getByTestId('site-version')).toHaveText('v2.3.4 · abc1234 · built 2026-01-02');
  });
});
