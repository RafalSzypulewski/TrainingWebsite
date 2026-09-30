import { test, expect } from '@playwright/test';

test.describe('Dynamic content', () => {
  test('loading quotes shows a spinner, then 5 quotes', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=500');
    await page.getByTestId('load-btn').click();
    await expect(page.getByTestId('load-spinner')).toBeVisible();
    await expect(page.getByTestId('load-btn')).toBeDisabled();

    await expect(page.getByTestId('load-status')).toHaveText('Loaded 5 quotes');
    await expect(page.getByTestId('quote')).toHaveCount(5);
    await expect(page.getByTestId('load-spinner')).toBeHidden();
  });

  test('?fail=true shows an error with a Retry button', async ({ page }) => {
    await page.goto('pages/dynamic.html?fail=true&delay=100');
    await page.getByTestId('load-btn').click();
    await expect(page.getByTestId('load-error')).toContainText('Server error (500)');
    await expect(page.getByTestId('quote')).toHaveCount(0);

    // Retry re-runs the request (which fails again while the toggle is on).
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('load-spinner')).toBeVisible();
    await expect(page.getByTestId('load-error')).toBeVisible();
  });

  test('delayed message appears without a fixed sleep', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=800');
    await page.getByTestId('delayed-btn').click();
    await expect(page.getByTestId('delayed-message')).toHaveCount(0);
    await expect(page.getByTestId('delayed-message')).toHaveText('Hello, I was worth the wait!');
  });

  test('temporary banner disappears by itself', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=700');
    await page.getByRole('button', { name: 'Show temporary banner' }).click();
    const banner = page.getByText('This banner disappears on its own.');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveCount(0);
  });

  test('box: remove (detached) vs hide (still in the DOM)', async ({ page }) => {
    await page.goto('pages/dynamic.html');
    const box = page.getByTestId('box');

    await page.getByTestId('hide-btn').click();
    await expect(box).toBeHidden();
    await expect(box).toHaveCount(1);
    await page.getByRole('button', { name: 'Show box' }).click();
    await expect(box).toBeVisible();

    await page.getByTestId('remove-btn').click();
    await expect(box).toHaveCount(0);
    await page.getByRole('button', { name: 'Add box' }).click();
    await expect(box).toBeVisible();
  });

  test('input becomes enabled after a delay', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=500');
    const input = page.getByLabel('Type here once enabled');
    await expect(input).toBeDisabled();
    await page.getByRole('button', { name: 'Enable input' }).click();
    await expect(input).toBeEnabled();
    await input.fill('hello');
    await expect(input).toHaveValue('hello');
  });

  test('progress bar reaches 100', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=1000');
    await page.getByRole('button', { name: 'Start task' }).click();
    await expect(page.getByTestId('progress-text')).not.toHaveText('0%');
    await expect(page.getByTestId('progress')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByTestId('progress-text')).toHaveText('Done!');
  });

  test('infinite scroll loads batches until the end', async ({ page }) => {
    await page.goto('pages/dynamic.html?delay=50');
    const items = page.getByTestId('scroll-list').getByRole('listitem');
    const box = page.getByTestId('scroll-box');

    await expect(items).toHaveCount(10);
    await expect(page.getByTestId('scroll-count')).toHaveText('Showing 10 of 60');

    await expect(async () => {
      await box.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(page.getByTestId('scroll-end')).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 15_000 });

    await expect(items).toHaveCount(60);
    await expect(items.last()).toHaveText('Item 60');
    await expect(page.getByTestId('scroll-count')).toHaveText('Showing 60 of 60');
  });

  test('infinite scroll shows an error when the request fails', async ({ page }) => {
    await page.goto('pages/dynamic.html?fail=true');
    await expect(page.getByTestId('scroll-error')).toHaveText('Server error (500)');
  });
});
