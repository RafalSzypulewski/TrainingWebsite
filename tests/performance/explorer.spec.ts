import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

const external = Boolean(process.env.BASE_URL?.trim());
const API = 'http://127.0.0.1:4182'; // a dedicated practice API instance, started by the Playwright config
const unique = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const card = (page: Page, id: string) => page.getByTestId(`endpoint-${id}`);
const fill = (endpoint: Locator, label: string, value: string) => endpoint.getByLabel(label, { exact: true }).fill(value);
const status = (endpoint: Locator) => endpoint.getByTestId('result-status');
const milliseconds = async (endpoint: Locator) => Number((await endpoint.getByTestId('result-time').textContent())!.replace(/\D/g, ''));

async function send(page: Page, id: string, values: Record<string, string> = {}) {
  const endpoint = card(page, id);
  for (const [label, value] of Object.entries(values)) await fill(endpoint, label, value);
  await endpoint.getByTestId(`send-${id}`).click();
  await expect(endpoint.getByTestId('result-status')).toBeVisible();
  return endpoint;
}

test.describe('API explorer without an API', () => {
  test('the controls are disabled and the page says why', async ({ page }) => {
    await page.goto('pages/performance-api.html');
    await expect(page.getByTestId('api-status')).toHaveText('Practice API offline');
    await expect(page.getByTestId('api-hint')).toContainText('The buttons below are disabled');
    await expect(page.getByTestId('send-health')).toBeDisabled();
    await expect(page.getByTestId('login-submit')).toBeDisabled();
  });

  test('lists all thirteen endpoints', async ({ page }) => {
    await page.goto('pages/performance-api.html');
    await expect(page.getByTestId('endpoints').getByRole('heading', { level: 3 })).toHaveCount(13);
    await expect(page.getByRole('heading', { name: 'GET /api/slow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'POST /api/checkout' })).toBeVisible();
  });

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('pages/performance-api.html');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
});

test.describe('API explorer with the practice API', () => {
  test.skip(external, 'needs the local practice API');
  // Error answers (404, 429, 500, ...) are logged by the browser as "Failed to load resource".
  test.use({ allowedConsoleErrors: [/Failed to load resource.*127\.0\.0\.1:4182/] });

  test.beforeEach(async ({ page }) => {
    await page.goto(`pages/performance-api.html?api=${API}`);
    await expect(page.getByTestId('api-status')).toHaveClass(/online/);
  });

  test('the controls are enabled once the API answers', async ({ page }) => {
    await expect(page.getByTestId('send-health')).toBeEnabled();
    await expect(page.getByTestId('login-submit')).toBeEnabled();
  });

  test('health shows status, time, size and the body', async ({ page }) => {
    const endpoint = await send(page, 'health');
    await expect(status(endpoint)).toHaveText('200 OK');
    await expect(status(endpoint)).toHaveClass(/ok/);
    await expect(endpoint.getByTestId('result-time')).toHaveText(/^\d+ ms$/);
    await expect(endpoint.getByTestId('result-size')).toHaveText(/^\d+ B$/);
    await expect(endpoint.getByTestId('result-body')).toContainText('"status": "ok"');
  });

  test('products: paging and filtering', async ({ page }) => {
    const first = await send(page, 'products', { size: '2' });
    await expect(first.getByTestId('result-body')).toContainText('Wireless Headphones');
    await expect(first.getByTestId('result-body')).toContainText('"total": 12');

    const books = await send(page, 'products', { size: '50', category: 'Books' });
    await expect(books.getByTestId('result-body')).toContainText('"total": 3');
  });

  test('a single product, and a 404', async ({ page }) => {
    const found = await send(page, 'product', { id: '2' });
    await expect(found.getByTestId('result-body')).toContainText('Mechanical Keyboard');

    const missing = await send(page, 'product', { id: '999' });
    await expect(status(missing)).toHaveText('404 Not Found');
    await expect(status(missing)).toHaveClass(/error/);
    await expect(missing.getByTestId('result-body')).toContainText('Product not found');
  });

  test('slow takes at least as long as asked', async ({ page }) => {
    const endpoint = await send(page, 'slow', { ms: '400' });
    expect(await milliseconds(endpoint)).toBeGreaterThanOrEqual(390);
    await expect(endpoint.getByTestId('result-body')).toContainText('"delayMs": 400');
  });

  test('flaky: rate 0 never fails, rate 1 always does', async ({ page }) => {
    await expect(status(await send(page, 'flaky', { rate: '0' }))).toHaveText('200 OK');
    await expect(status(await send(page, 'flaky', { rate: '1' }))).toHaveText('500 Internal Server Error');
  });

  test('status echoes the requested code', async ({ page }) => {
    const endpoint = await send(page, 'status', { code: '503' });
    await expect(status(endpoint)).toHaveText(/^503/);
    await expect(status(endpoint)).toHaveClass(/error/);
  });

  test('payload: size, and gzip makes the wire size smaller', async ({ page }) => {
    const plain = await send(page, 'payload', { kb: '50' });
    await expect(plain.getByTestId('result-size')).toHaveText('51200 B');
    await expect(plain.getByTestId('result-headers')).not.toContainText('content-encoding');

    await card(page, 'payload').getByLabel('gzip', { exact: true }).selectOption('1');
    await card(page, 'payload').getByTestId('send-payload').click();
    await expect(plain.getByTestId('result-size')).toContainText('51200 B decoded');
    await expect(plain.getByTestId('result-size')).toContainText('over the wire');
    await expect(plain.getByTestId('result-headers')).toContainText('content-encoding: gzip');
  });

  test('limited: the third call is rejected and Retry-After is shown', async ({ page }) => {
    const key = unique();
    const values = { limit: '2', window: '30', key };
    await expect(status(await send(page, 'limited', values))).toHaveText('200 OK');
    await expect(status(await send(page, 'limited', values))).toHaveText('200 OK');

    const third = await send(page, 'limited', values);
    await expect(status(third)).toHaveText('429 Too Many Requests');
    await expect(third.getByTestId('result-headers')).toContainText('retry-after');
    await expect(third.getByTestId('result-headers')).toContainText('x-ratelimit-remaining: 0');
  });

  test('queue: a lone request does not wait', async ({ page }) => {
    const endpoint = await send(page, 'queue', { workers: '1', ms: '100', key: unique() });
    await expect(status(endpoint)).toHaveText('200 OK');
    await expect(endpoint.getByTestId('result-body')).toContainText('"waitedMs": 0');
  });

  test('a network failure is reported, not hidden', async ({ page }) => {
    await page.route(`${API}/api/health`, (route) => route.abort('connectionrefused'));
    const endpoint = card(page, 'health');
    await endpoint.getByTestId('send-health').click();
    await expect(endpoint.getByTestId('result-error')).toContainText('Request failed');
  });
});

test.describe('API explorer: login, cart and checkout', () => {
  test.skip(external, 'needs the local practice API');
  test.use({ allowedConsoleErrors: [/Failed to load resource.*127\.0\.0\.1:4182/] });

  test.beforeEach(async ({ page }) => {
    await page.goto(`pages/performance-api.html?api=${API}`);
    await expect(page.getByTestId('api-status')).toHaveClass(/online/);
  });

  test('protected endpoints answer 401 until you log in', async ({ page }) => {
    await expect(page.getByTestId('session-status')).toHaveText('Not logged in.');
    const me = await send(page, 'me');
    await expect(status(me)).toHaveText('401 Unauthorized');
    await expect(me.getByTestId('result-body')).toContainText('Missing or invalid token');
  });

  test('log in, shop, check out, log out', async ({ page }) => {
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('session-status')).toHaveText('Logged in as student (user).');
    await expect(page.getByTestId('logout')).toBeVisible();

    const me = await send(page, 'me');
    await expect(me.getByTestId('result-body')).toContainText('"username": "student"');

    const added = await send(page, 'cart-add', { productId: '12', qty: '2' });
    await expect(status(added)).toHaveText('201 Created');
    await expect(added.getByTestId('result-body')).toContainText('"total": 3099'); // 2 x $12.50 + $5.99 shipping

    const order = await send(page, 'checkout');
    await expect(status(order)).toHaveText('201 Created');
    await expect(order.getByTestId('result-body')).toContainText(/"id": "ORD-\d+"/);

    const cart = await send(page, 'cart');
    await expect(cart.getByTestId('result-body')).toContainText('"items": []');

    await page.getByTestId('logout').click();
    await expect(page.getByTestId('session-status')).toHaveText('Not logged in.');
    await expect(status(await send(page, 'me'))).toHaveText('401 Unauthorized');
  });

  test('a bad password and a locked account are reported', async ({ page }) => {
    await page.getByTestId('login-password').fill('wrong');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('session-status')).toHaveText('Login failed: Invalid username or password (401).');

    await page.getByTestId('login-username').fill('locked');
    await page.getByTestId('login-password').fill('Locked123!');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('session-status')).toHaveText('Login failed: This account is locked (423).');
  });

  test('stock limits come back as 409', async ({ page }) => {
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('logout')).toBeVisible();
    const soldOut = await send(page, 'cart-add', { productId: '3', qty: '1' });
    await expect(status(soldOut)).toHaveText('409 Conflict');
    await expect(soldOut.getByTestId('result-body')).toContainText('Out of stock');
  });

  test('the token lives in sessionStorage, so it is per tab', async ({ page }) => {
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('logout')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('pw_perf_token'))).toMatch(/^[0-9a-f]{32}$/);
    await page.reload();
    await expect(page.getByTestId('session-status')).toContainText('Logged in.');
  });
});

test.describe('API explorer: the whole API mocked', () => {
  const FAKE = 'http://localhost:9998';
  const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After' };
  test.use({ allowedConsoleErrors: [/Failed to load resource.*localhost:9998/] }); // the mocked 503

  test('the page can be tested without any server', async ({ page }) => {
    await page.route(`${FAKE}/api/health`, (route) => route.fulfill({ json: { status: 'ok' }, headers: CORS }));
    await page.route(`${FAKE}/api/products*`, (route) =>
      route.fulfill({ status: 200, json: { page: 1, size: 5, total: 1, items: [{ id: 7, name: 'Mock Product' }] }, headers: CORS }));
    await page.route(`${FAKE}/api/flaky*`, (route) => route.fulfill({ status: 503, json: { error: 'mocked outage' }, headers: { ...CORS, 'retry-after': '7' } }));

    await page.goto(`pages/performance-api.html?api=${FAKE}`);
    await expect(page.getByTestId('api-status')).toHaveClass(/online/);

    const products = await send(page, 'products');
    await expect(products.getByTestId('result-body')).toContainText('Mock Product');

    const flaky = await send(page, 'flaky');
    await expect(status(flaky)).toHaveText(/^503/);
    await expect(flaky.getByTestId('result-headers')).toContainText('retry-after: 7');
  });
});
