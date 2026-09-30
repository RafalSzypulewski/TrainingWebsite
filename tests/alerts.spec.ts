import { test, expect } from './fixtures';

test.describe('Alerts and dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/alerts.html');
    // The cookie banner overlays the page bottom; accept it so it does not get in the way.
    await page.getByTestId('cookie-accept').click();
  });

  const result = (page: import('@playwright/test').Page) => page.getByTestId('dialog-result');

  test('alert: read the message and accept it', async ({ page }) => {
    const messages: string[] = [];
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      messages.push(dialog.message());
      await dialog.accept();
    });
    await page.getByTestId('alert-btn').click();
    await expect(result(page)).toHaveText('Alert closed');
    expect(messages).toEqual(['Hello from an alert!']);
  });

  test('confirm: accept and dismiss', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('confirm-btn').click();
    await expect(result(page)).toHaveText('You clicked OK');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByTestId('confirm-btn').click();
    await expect(result(page)).toHaveText('You clicked Cancel');
  });

  test('prompt: default value, custom answer and cancel', async ({ page }) => {
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('What is your name?');
      expect(dialog.defaultValue()).toBe('Guest');
      await dialog.accept('Ada');
    });
    await page.getByRole('button', { name: 'Show prompt' }).click();
    await expect(result(page)).toHaveText('Hello, Ada!');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Show prompt' }).click();
    await expect(result(page)).toHaveText('Prompt cancelled');
  });

  test('modal: confirm, cancel and Escape', async ({ page }) => {
    const modal = page.getByRole('dialog', { name: 'Subscribe to updates' });

    await page.getByTestId('modal-btn').click();
    await expect(modal).toBeVisible();
    await page.getByTestId('modal-email').fill('ada@example.com');
    await page.getByTestId('modal-confirm').click();
    await expect(modal).toBeHidden();
    await expect(result(page)).toHaveText('Modal confirmed with email: ada@example.com');

    await page.getByTestId('modal-btn').click();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(result(page)).toHaveText('Modal cancelled');

    await page.getByTestId('modal-btn').click();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(result(page)).toHaveText('Modal dismissed');
  });

  test('modal blocks interaction with the page behind it', async ({ page }) => {
    await page.getByTestId('modal-btn').click();
    await expect(page.getByTestId('alert-btn').click({ timeout: 1000 })).rejects.toThrow();
  });

  test('toast: appears, can be closed, auto-dismisses', async ({ page }) => {
    await page.goto('pages/alerts.html?delay=800');
    const toast = page.getByTestId('toast');

    await page.getByTestId('toast-success').click();
    await expect(toast).toHaveText(/Saved successfully/);
    await toast.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(toast).toHaveCount(0);

    await page.getByRole('button', { name: 'Error toast' }).click();
    await expect(toast).toHaveText(/Something went wrong/);
    await expect(toast).toHaveCount(0); // gone after the delay
  });
});

test.describe('Cookie banner', () => {
  test('is shown first, blocks clicks, and accepting stores a cookie', async ({ page, context }) => {
    await page.goto('pages/alerts.html');
    const banner = page.getByRole('dialog', { name: 'Cookie consent' });
    await expect(banner).toBeVisible();
    await expect(page.getByTestId('consent-status')).toHaveText('not chosen');

    await page.getByTestId('cookie-accept').click();
    await expect(banner).toBeHidden();
    await expect(page.getByTestId('consent-status')).toHaveText('accepted');
    const cookie = (await context.cookies()).find((c) => c.name === 'pw_cookie_consent');
    expect(cookie?.value).toBe('accepted');

    await page.reload();
    await expect(banner).toBeHidden();
  });

  test('rejecting stores "rejected"; Reset data brings the banner back', async ({ page }) => {
    await page.goto('pages/alerts.html');
    await page.getByRole('button', { name: 'Reject non-essential' }).click();
    await expect(page.getByTestId('consent-status')).toHaveText('rejected');

    await page.getByTestId('reset-data').click();
    await expect(page.getByTestId('cookie-banner')).toBeVisible();
  });
});
