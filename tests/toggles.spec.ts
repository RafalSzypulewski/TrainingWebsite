import { test, expect } from './fixtures';
import { USERS } from './helpers';

test.describe('Toggle panel', () => {
  test('is collapsed by default and opens from its summary', async ({ page }) => {
    await page.goto('index.html');
    const panel = page.getByTestId('toggle-panel');
    await expect(panel).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('toggle-apply')).toBeHidden();

    await page.getByText('Test toggles').click();
    await expect(panel).toHaveAttribute('open', '');
    await expect(page.getByTestId('toggle-delay')).toHaveValue('');
    await expect(page.getByTestId('toggle-fail')).not.toBeChecked();
  });

  test('is open and pre-filled when the URL already has toggles', async ({ page }) => {
    await page.goto('pages/shop.html?delay=700&fail=true');
    await expect(page.getByTestId('toggle-panel')).toHaveAttribute('open', '');
    await expect(page.getByTestId('toggle-delay')).toHaveValue('700');
    await expect(page.getByTestId('toggle-fail')).toBeChecked();
    await expect(page.getByTestId('active-toggles')).toContainText('delay=700, fail=true');
  });

  test('applying a delay and fail puts them in the URL', async ({ page }) => {
    await page.goto('index.html');
    await page.getByText('Test toggles').click();
    await page.getByLabel('Delay (ms)').fill('1500');
    await page.getByLabel('Fail requests').check();
    await page.getByRole('button', { name: 'Apply toggles' }).click();

    await expect(page).toHaveURL(/index\.html\?delay=1500&fail=true$/);
    await expect(page.getByTestId('active-toggles')).toContainText('delay=1500, fail=true');
    await expect(page.getByTestId('toggle-panel')).toHaveAttribute('open', '');
    await expect(page.getByLabel('Delay (ms)')).toHaveValue('1500');
  });

  test('other query parameters are kept', async ({ page }) => {
    await page.goto('pages/product.html?id=2');
    await page.getByText('Test toggles').click();
    await page.getByTestId('toggle-delay').fill('300');
    await page.getByTestId('toggle-apply').click();

    await expect(page).toHaveURL(/product\.html\?id=2&delay=300$/);
    await expect(page.getByTestId('product-name')).toHaveText('Mechanical Keyboard');
  });

  test('emptying the delay and unticking fail removes them', async ({ page }) => {
    await page.goto('pages/product.html?id=2&delay=300&fail=false');
    await page.getByTestId('toggle-delay').fill('');
    await page.getByTestId('toggle-apply').click();
    await expect(page).toHaveURL(/product\.html\?id=2$/);
    await expect(page.getByTestId('active-toggles')).toHaveCount(0);
  });

  test('Clear toggles removes both and keeps everything else', async ({ page }) => {
    await page.goto('pages/shop.html?q=book&delay=200&fail=true');
    await page.getByRole('button', { name: 'Clear toggles' }).click();
    await expect(page).toHaveURL(/shop\.html\?q=book$/);
    await expect(page.getByTestId('active-toggles')).toHaveCount(0);
    await expect(page.getByTestId('search')).toHaveValue('book');
  });

  test('rejects an invalid delay without navigating', async ({ page }) => {
    await page.goto('index.html');
    await page.getByText('Test toggles').click();
    const delay = page.getByTestId('toggle-delay');

    for (const bad of ['-5', '1.5']) {
      await delay.fill(bad);
      await page.getByTestId('toggle-apply').click();
      await expect(page.getByTestId('toggle-error')).toHaveText('Delay must be a whole number of milliseconds (0 or more).');
      await expect(delay).toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL(/index\.html$/);
    }
  });

  test('a delay set through the panel really slows the login', async ({ page }) => {
    await page.goto('pages/login.html');
    await page.getByText('Test toggles').click();
    await page.getByTestId('toggle-delay').fill('1200');
    await page.getByTestId('toggle-apply').click();

    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-spinner')).toBeVisible();
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test('fail set through the panel makes the login fail', async ({ page }) => {
    await page.goto('pages/login.html');
    await page.getByText('Test toggles').click();
    await page.getByLabel('Fail requests').check();
    await page.getByRole('button', { name: 'Apply toggles' }).click();

    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toHaveText('Server error (500)');
  });
});
