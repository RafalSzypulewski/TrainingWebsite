import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';
import type { Page, Route } from '@playwright/test';

// Running against the deployed site (BASE_URL) there is no practice API next to it.
const external = Boolean(process.env.BASE_URL?.trim());
const FAKE_API = 'http://localhost:9999';
const CORS = { 'access-control-allow-origin': '*' };

const badge = (page: Page) => page.getByTestId('api-status');

test.describe('Performance lab: static content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/performance.html');
  });

  test('explains the lab and warns against load testing sites you do not own', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Performance lab', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'k6', exact: true })).toHaveAttribute('href', /grafana\.com\/docs\/k6/);
    await expect(page.getByText('Never point a load test at a site you do not own.')).toBeVisible();
  });

  test('setup steps and reference scripts are listed', async ({ page }) => {
    await expect(page.getByTestId('setup-steps').getByRole('listitem')).toHaveCount(5);
    await expect(page.getByTestId('setup-steps')).toContainText('npm run perf:smoke');

    const rows = page.getByTestId('scripts-table').getByRole('row');
    await expect(rows).toHaveCount(5); // header + 4 scripts
    await expect(rows.filter({ hasText: 'perf:stress' })).toContainText('red, on purpose');
  });

  test('the six k6 exercises and the vocabulary are there', async ({ page }) => {
    await expect(page.getByTestId('k6-exercises').getByRole('listitem')).toHaveCount(6);
    for (const term of ['Virtual user (VU)', 'Threshold', 'Percentile (p95)', 'Closed model', 'Open model', 'Saturation']) {
      await expect(page.getByTestId('glossary').getByText(term, { exact: true })).toBeVisible();
    }
  });

  test('the link to the explorer works and the exercises link to the repository', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'perf/EXERCISES.md' })).toHaveAttribute('href', /github\.com\/.+\/perf\/EXERCISES\.md$/);
    await page.getByTestId('open-explorer').click();
    await expect(page).toHaveURL(/performance-api\.html$/);
    await expect(page.getByRole('heading', { name: 'API explorer', level: 1 })).toBeVisible();
  });

  test('has no serious or critical accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
});

test.describe('Performance lab: API status', () => {
  test('without an API the page says so, and sends no API request at all', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiRequests.push(request.url());
    });
    await page.goto('pages/performance.html');
    await expect(badge(page)).toHaveText('Practice API offline');
    await expect(badge(page)).toHaveClass(/offline/);
    expect(apiRequests).toEqual([]); // no failing probe, so no red errors in the console either
  });

  test('on a local server the hint explains how to start the API', async ({ page }) => {
    test.skip(external, 'only meaningful on a local server');
    await page.goto('pages/performance.html');
    await expect(page.getByTestId('api-hint')).toContainText('npm run perf:server');
    await expect(page.getByTestId('api-hint')).toContainText('?api=http://127.0.0.1:4180');
  });

  test('on a static host the hint says the API cannot run there', async ({ page }) => {
    test.skip(!external, 'only meaningful on the deployed site');
    await page.goto('pages/performance.html');
    await expect(page.getByTestId('api-hint')).toContainText('hosted as static files');
  });

  test.describe('with the API address given in the URL', () => {
    // Probing a closed port or a mocked failure makes the browser log "Failed to load resource".
    test.use({ allowedConsoleErrors: [/Failed to load resource.*localhost:9999/] });

    test('a healthy API turns the badge green', async ({ page }) => {
      await page.route(`${FAKE_API}/api/health`, (route) => route.fulfill({ json: { status: 'ok' }, headers: CORS }));
      await page.goto(`pages/performance.html?api=${FAKE_API}`);
      await expect(badge(page)).toHaveText(`Practice API online (${FAKE_API})`);
      await expect(badge(page)).toHaveClass(/online/);
      await expect(page.getByTestId('api-hint')).toContainText('API explorer');
    });

    test('an unhealthy answer, a broken body or a refused connection all mean offline', async ({ page }) => {
      const states: Record<string, (route: Route) => Promise<void>> = {
        'status 500': (route) => route.fulfill({ status: 500, json: { error: 'down' }, headers: CORS }),
        'wrong body': (route) => route.fulfill({ json: { status: 'degraded' }, headers: CORS }),
        'not json': (route) => route.fulfill({ body: '<html>oops</html>', headers: CORS }),
        'connection refused': (route) => route.abort('connectionrefused'),
      };
      for (const [name, handler] of Object.entries(states)) {
        await page.route(`${FAKE_API}/api/health`, handler);
        await page.goto(`pages/performance.html?api=${FAKE_API}`);
        await expect(badge(page), name).toHaveText('Practice API offline');
        await expect(page.getByTestId('api-hint'), name).toContainText(`Could not reach ${FAKE_API}`);
        await page.unroute(`${FAKE_API}/api/health`);
      }
    });

    test('"Check again" re-checks without reloading the page', async ({ page }) => {
      await page.route(`${FAKE_API}/api/health`, (route) => route.abort('connectionrefused'));
      await page.goto(`pages/performance.html?api=${FAKE_API}`);
      await expect(badge(page)).toHaveText('Practice API offline');

      await page.unroute(`${FAKE_API}/api/health`);
      await page.route(`${FAKE_API}/api/health`, (route) => route.fulfill({ json: { status: 'ok' }, headers: CORS }));
      await page.getByTestId('api-recheck').click();
      await expect(badge(page)).toHaveClass(/online/);
    });
  });

  test('an api parameter that is not localhost is ignored and never contacted', async ({ page }) => {
    const contacted: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'example.com') contacted.push(request.url());
    });
    await page.goto('pages/performance.html?api=https://example.com');
    await expect(badge(page)).toHaveText('Practice API offline');
    await expect(page.getByTestId('api-hint')).toContainText('it must point to localhost');
    expect(contacted).toEqual([]);
  });

  test('the real practice API is recognised', async ({ page }) => {
    test.skip(external, 'needs the local practice API');
    await page.goto('pages/performance.html?api=http://127.0.0.1:4182');
    await expect(badge(page)).toHaveText('Practice API online (http://127.0.0.1:4182)');
  });

  test('served by the practice server itself, the API is found without any parameter', async ({ page }) => {
    test.skip(external, 'needs the local practice API');
    await page.goto('http://127.0.0.1:4182/pages/performance.html');
    await expect(badge(page)).toHaveText('Practice API online (http://127.0.0.1:4182)');
  });
});
