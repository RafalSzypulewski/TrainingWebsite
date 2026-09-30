import { test, expect } from './fixtures';

const status = (page: import('@playwright/test').Page) => page.getByTestId('tricky-status');

test.describe('Tricky elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/tricky.html?delay=500');
  });

  test('duplicate ids: CSS matches all, role and text pick the right one', async ({ page }) => {
    await expect(page.locator('#duplicate')).toHaveCount(3);
    await expect(page.locator('#duplicate').click()).rejects.toThrow(/strict mode violation/);

    await page.locator('#duplicate').nth(1).click();
    await expect(status(page)).toHaveText('Clicked: Second duplicate');
    await page.getByRole('button', { name: 'Third duplicate' }).click();
    await expect(status(page)).toHaveText('Clicked: Third duplicate');
    await page.locator('#duplicate').first().click();
    await expect(status(page)).toHaveText('Clicked: First duplicate');
  });

  test('classes change constantly, but role locators are stable', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Shape-shifting button' });
    const first = await button.getAttribute('class');
    await expect.poll(() => button.getAttribute('class')).not.toBe(first);

    await button.click();
    await button.click();
    await expect(status(page)).toHaveText('Shape-shifting button clicked 2 time(s)');
  });

  test('random ids: use the label instead', async ({ page }) => {
    const input = page.getByLabel('Input with a random id');
    await input.fill('typed by label');
    await expect(input).toHaveValue('typed by label');
    expect(await input.getAttribute('id')).toMatch(/^field-[a-z0-9]+$/);
  });

  test('button enabled after a delay', async ({ page }) => {
    const button = page.getByTestId('delayed-enable');
    await expect(button).toBeDisabled();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(status(page)).toHaveText('Delayed button clicked');
  });

  test('click auto-waits for the delayed-enable button', async ({ page }) => {
    await page.getByRole('button', { name: 'Enabled after a delay' }).click(); // no explicit wait
    await expect(status(page)).toHaveText('Delayed button clicked');
  });

  test('button disables itself after a click, then recovers', async ({ page }) => {
    const button = page.getByTestId('disable-after-click');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(status(page)).toHaveText('Self-disabling button clicked');
    await expect(button).toBeEnabled();
  });

  test('covered button: fails fast while covered, succeeds once the overlay is gone', async ({ page }) => {
    await page.goto('pages/tricky.html?delay=1500');
    await expect(page.getByTestId('cover')).toBeVisible();
    await expect(page.getByTestId('covered-btn').click({ timeout: 300 })).rejects.toThrow(/intercepts pointer events/);

    await page.getByTestId('covered-btn').click(); // retries until the overlay disappears
    await expect(page.getByTestId('cover')).toHaveCount(0);
    await expect(status(page)).toHaveText('Covered button clicked');
  });

  test('moving target: Playwright waits for it to be stable', async ({ page }) => {
    await page.getByTestId('moving-btn').click();
    await expect(status(page)).toHaveText('Moving target clicked');
  });

  test('re-rendering list: locators are re-resolved on every action', async ({ page }) => {
    for (const n of [1, 3, 2, 4]) {
      await page.getByRole('button', { name: `Item ${n}` }).click();
      await expect(status(page)).toHaveText(`Clicked Item ${n}`);
    }
  });

  test('hidden in different ways', async ({ page }) => {
    for (const id of ['v-display-none', 'v-visibility', 'v-hidden-attr', 'v-zero']) {
      await expect(page.getByTestId(id), id).toBeHidden();
    }
    // Playwright treats these as visible: they have a non-empty box and no visibility:hidden.
    for (const id of ['v-opacity', 'v-offscreen', 'v-shown']) {
      await expect(page.getByTestId(id), id).toBeVisible();
    }
    await expect(page.getByTestId('v-opacity')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('v-offscreen')).not.toBeInViewport();
  });

  test('identical Delete buttons: filter by row', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(3);
    await page.getByRole('listitem').filter({ hasText: 'Banana' }).getByRole('button', { name: 'Delete' }).click();
    await expect(status(page)).toHaveText('Deleted: Banana');
    await expect(page.getByTestId('delete-list').getByRole('listitem')).toHaveCount(2);
    await expect(page.getByTestId('row-banana')).toHaveCount(0);

    await page.getByTestId('row-apple').getByRole('button').click();
    await expect(page.getByTestId('delete-list').locator('span')).toHaveText(['Cherry']);
  });

  test('whitespace in text is normalised', async ({ page }) => {
    await expect(page.getByTestId('messy-text')).toHaveText('Hello World from the page');
    await expect(page.getByText('Hello World from the page')).toBeVisible();
  });

  test('disabled, aria-disabled, read-only and content-editable', async ({ page }) => {
    await expect(page.getByTestId('native-disabled')).toBeDisabled();
    await expect(page.getByTestId('aria-disabled')).toBeDisabled(); // aria-disabled counts for Playwright
    await expect(page.getByTestId('aria-disabled')).toHaveAttribute('aria-disabled', 'true');

    const readonly = page.getByLabel('Read-only input');
    await expect(readonly).not.toBeEditable();
    await expect(readonly.fill('x', { timeout: 500 })).rejects.toThrow();
    await expect(readonly).toHaveValue('cannot edit me');

    const editable = page.getByRole('textbox', { name: 'Content editable' });
    await editable.fill('Typed into a div');
    await expect(editable).toHaveText('Typed into a div');
    await expect(editable).toBeEditable();
  });

  test('far button is scrolled into view automatically', async ({ page }) => {
    const far = page.getByTestId('far-btn');
    await expect(far).not.toBeInViewport();
    await far.click();
    await expect(far).toBeInViewport();
    await expect(status(page)).toHaveText('Far away button clicked');
  });

  test('seeded "random" delay is reproducible', async ({ page }) => {
    // Same LCG as the page, so the test can predict the value.
    const lcg = (seed: number) => Math.round(300 + (((seed * 1664525 + 1013904223) % 4294967296) / 4294967296) * 1700);
    const expected = lcg(1);

    for (let i = 0; i < 2; i++) {
      await page.goto('pages/tricky.html?seed=1&delay=100');
      await page.getByTestId('random-btn').click();
      await expect(page.getByRole('progressbar', { name: 'Working' })).toBeVisible();
      await expect(page.getByTestId('random-result')).toHaveText(`Done after ${expected} ms`);
    }
  });
});
