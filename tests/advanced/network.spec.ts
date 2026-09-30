import { test, expect } from '../support/fixtures';
import type { Route } from '@playwright/test';

const USERS = '**/assets/data/api/users.json*';
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Network: users list', () => {
  // These tests mock failures on purpose, and the browser logs each failed request.
  test.use({ allowedConsoleErrors: [/Failed to load resource.*assets\/data\/api\/users\.json/] });

  test.beforeEach(async ({ page }) => {
    await page.goto('pages/network.html');
  });

  test('real (unmocked) response', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/assets/data/api/users.json*');
    await page.getByTestId('users-btn').click();
    expect((await responsePromise).status()).toBe(200);
    await expect(page.getByTestId('user')).toHaveCount(3);
    await expect(page.getByTestId('user').first()).toHaveText('Ada Lovelace <ada@example.com>');
  });

  test('mocked data replaces the real response', { tag: '@smoke' }, async ({ page }) => {
    await page.route(USERS, (route) => json(route, [{ id: 9, name: 'Mock Person', email: 'mock@test.dev' }]));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('user')).toHaveText(['Mock Person <mock@test.dev>']);
  });

  test('empty list', async ({ page }) => {
    await page.route(USERS, (route) => json(route, []));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('users-empty')).toBeVisible();
    await expect(page.getByTestId('user')).toHaveCount(0);
  });

  test('server error (500)', async ({ page }) => {
    await page.route(USERS, (route) => json(route, { error: 'boom' }, 500));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('users-error')).toHaveText('Failed to load users: Server responded with 500');
  });

  test('network failure (aborted request)', async ({ page }) => {
    await page.route(USERS, (route) => route.abort('connectionrefused'));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('users-error')).toHaveText('Failed to load users: Network error: could not reach the server');
  });

  test('malformed body', async ({ page }) => {
    await page.route(USERS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{not json' }));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('users-error')).toHaveText('Failed to load users: Invalid response from the server');
  });

  test('delayed response shows the spinner', async ({ page }) => {
    await page.route(USERS, async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fallback(); // continue to the real file
    });
    await page.getByTestId('users-btn').click();
    const spinner = page.getByRole('progressbar', { name: 'Loading users' });
    await expect(spinner).toBeVisible();
    await expect(page.getByTestId('users-btn')).toBeDisabled();
    await expect(page.getByTestId('user')).toHaveCount(3);
    await expect(spinner).toBeHidden();
  });

  test('request carries the custom header and query parameter', async ({ page }) => {
    const requestPromise = page.waitForRequest(USERS);
    await page.getByTestId('users-btn').click();
    const request = await requestPromise;
    expect(request.method()).toBe('GET');
    expect(request.headers()['x-practice-client']).toBe('pw-lab');
    expect(new URL(request.url()).searchParams.get('page')).toBe('1');
  });

  test('an error can be followed by a successful retry', async ({ page }) => {
    let calls = 0;
    await page.route(USERS, (route) => (++calls === 1 ? json(route, {}, 503) : route.fallback()));
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('users-error')).toContainText('503');
    await page.getByTestId('users-btn').click();
    await expect(page.getByTestId('user')).toHaveCount(3);
    await expect(page.getByTestId('users-error')).toBeHidden();
  });
});

test.describe('Network: timeout, retries and polling', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource.*assets\/data\/api\/(flaky|status)\.json/] });

  test('slow request times out', async ({ page }) => {
    await page.route('**/assets/data/api/slow.json', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"too late"}' }).catch(() => {});
    });
    await page.goto('pages/network.html?timeout=500');
    await expect(page.getByTestId('timeout-ms')).toHaveText('500');
    await page.getByTestId('slow-btn').click();
    await expect(page.getByTestId('slow-status')).toHaveText('Request timed out after 500 ms');
    await expect(page.getByTestId('slow-btn')).toBeEnabled();
  });

  test('fast enough request succeeds', async ({ page }) => {
    await page.goto('pages/network.html');
    await page.getByTestId('slow-btn').click();
    await expect(page.getByTestId('slow-status')).toHaveText('Loaded: Finally here!');
  });

  test('succeeds on the first attempt when unmocked', async ({ page }) => {
    await page.goto('pages/network.html');
    await page.getByTestId('retry-btn').click();
    await expect(page.getByTestId('retry-status')).toHaveText('Flaky endpoint answered after 1 attempt');
  });

  test('fails twice, then succeeds on attempt 3', async ({ page }) => {
    let calls = 0;
    await page.route('**/assets/data/api/flaky.json', (route) => (++calls < 3 ? route.abort() : route.fallback()));
    await page.goto('pages/network.html');
    await page.getByTestId('retry-btn').click();
    await expect(page.getByTestId('retry-status')).toHaveText('Flaky endpoint answered after 3 attempts');
    expect(calls).toBe(3);
  });

  test('gives up after three failures', async ({ page }) => {
    await page.route('**/assets/data/api/flaky.json', (route) => json(route, {}, 503));
    await page.goto('pages/network.html');
    await page.getByTestId('retry-btn').click();
    await expect(page.getByTestId('retry-status')).toHaveText('Gave up after 3 attempts: Server responded with 503');
    await expect(page.getByTestId('retry-btn')).toBeEnabled();
  });

  test('polling: pending, pending, then done', async ({ page }) => {
    const states = [
      { state: 'pending', progress: 10 },
      { state: 'pending', progress: 60 },
      { state: 'done', progress: 100 },
    ];
    let calls = 0;
    await page.route('**/assets/data/api/status.json', (route) => json(route, states[Math.min(calls++, states.length - 1)]));
    await page.goto('pages/network.html?poll=100');
    await page.getByTestId('poll-start').click();
    await expect(page.getByTestId('poll-status')).toHaveText('Job finished after 3 polls');
    await expect(page.getByTestId('poll-start')).toBeEnabled();
    expect(calls).toBe(3); // polling really stopped
  });

  test('polling can be stopped manually', async ({ page }) => {
    await page.route('**/assets/data/api/status.json', (route) => json(route, { state: 'running', progress: 5 }));
    await page.goto('pages/network.html?poll=100');
    await page.getByTestId('poll-start').click();
    await expect(page.getByTestId('poll-status')).toContainText('Job running');
    await page.getByRole('button', { name: 'Stop polling' }).click();
    await expect(page.getByTestId('poll-status')).toHaveText('Polling stopped');
  });

  test('polling reports an error', async ({ page }) => {
    await page.route('**/assets/data/api/status.json', (route) => json(route, {}, 500));
    await page.goto('pages/network.html?poll=100');
    await page.getByTestId('poll-start').click();
    await expect(page.getByTestId('poll-status')).toHaveText('Polling failed: Server responded with 500');
  });
});

test.describe('Network: POST feedback', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource.*\/api\/feedback/] });

  test.beforeEach(async ({ page }) => {
    await page.goto('pages/network.html');
  });

  test('mocked success: asserts the request body', async ({ page }) => {
    let body: unknown;
    await page.route('**/api/feedback', async (route) => {
      body = route.request().postDataJSON();
      expect(route.request().method()).toBe('POST');
      await json(route, { id: 42, status: 'queued' }, 201);
    });
    await page.getByTestId('fb-name').fill('Ada');
    await page.getByTestId('fb-message').fill('Great lab!');
    await page.getByTestId('fb-submit').click();
    await expect(page.getByTestId('fb-status')).toHaveText('Thanks! Feedback #42 received (queued)');
    expect(body).toEqual({ name: 'Ada', message: 'Great lab!' });
  });

  test('name defaults to Anonymous', async ({ page }) => {
    const requestPromise = page.waitForRequest('**/api/feedback');
    await page.route('**/api/feedback', (route) => json(route, { id: 1, status: 'ok' }, 201));
    await page.getByTestId('fb-message').fill('hi');
    await page.getByTestId('fb-submit').click();
    expect((await requestPromise).postDataJSON()).toEqual({ name: 'Anonymous', message: 'hi' });
  });

  test('empty message is rejected without a request', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/feedback', (route) => { requests++; return json(route, {}, 201); });
    await page.getByTestId('fb-submit').click();
    await expect(page.getByText('Please enter a message')).toBeVisible();
    expect(requests).toBe(0);
  });

  test('server error and network failure', async ({ page }) => {
    await page.getByTestId('fb-message').fill('hello');

    await page.route('**/api/feedback', (route) => json(route, {}, 500));
    await page.getByTestId('fb-submit').click();
    await expect(page.getByTestId('fb-status')).toHaveText('Could not send feedback: Server responded with 500');

    await page.unroute('**/api/feedback');
    await page.route('**/api/feedback', (route) => route.abort());
    await page.getByTestId('fb-submit').click();
    await expect(page.getByTestId('fb-status')).toHaveText('Could not send feedback: network error');
  });

  test('without a mock the static host cannot answer', async ({ page }) => {
    await page.getByTestId('fb-message').fill('hello');
    await page.getByTestId('fb-submit').click();
    await expect(page.getByTestId('fb-status')).toContainText('Could not send feedback');
  });
});
