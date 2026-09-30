import { test, expect } from '@playwright/test';

test.describe('Windows and frames', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/windows.html');
  });

  test('link opens a new tab', async ({ page }) => {
    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('new-tab-link').click();
    const popup = await popupPromise;

    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/popup\.html\?from=link/);
    await expect(popup.getByTestId('popup-title')).toHaveText('I am a new tab');
    await expect(popup.getByTestId('popup-message')).toContainText('link');
    await expect(page.getByRole('heading', { name: 'Windows & frames' })).toBeVisible(); // original still there
  });

  test('window.open popup can be closed from the page inside it', async ({ page }) => {
    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('popup-btn').click();
    const popup = await popupPromise;

    await expect(popup.getByTestId('popup-message')).toContainText('window.open');
    const closed = popup.waitForEvent('close');
    await popup.getByTestId('popup-close').click();
    await closed;
    expect(popup.isClosed()).toBe(true);
    await expect(page.getByTestId('popup-btn')).toBeEnabled();
  });

  test('iframe: type and click inside via frameLocator', async ({ page }) => {
    const frame = page.frameLocator('iframe[title="Simple frame"]');
    await expect(frame.getByTestId('frame-title')).toHaveText('Inside the simple frame');
    await frame.getByLabel('Frame input').fill('Playwright');
    await frame.getByRole('button', { name: 'Say hello' }).click();
    await expect(frame.getByTestId('frame-out')).toHaveText('Hello, Playwright!');
    // Elements outside the frame are unaffected.
    await expect(page.getByTestId('outside-frame-text')).toBeVisible();
  });

  test('nested iframes: chain frameLocator calls', async ({ page }) => {
    const outer = page.frameLocator('[data-testid="outer-frame"]');
    const inner = outer.frameLocator('iframe[name="inner-frame"]');

    await outer.getByRole('button', { name: 'Outer button' }).click();
    await expect(outer.locator('#outer-out')).toHaveText('Outer button clicked');

    await expect(inner.getByTestId('inner-title')).toBeVisible();
    await inner.getByRole('button', { name: 'Inner button' }).click();
    await expect(inner.getByTestId('inner-out')).toHaveText('Inner button clicked');
  });

  test('find a frame by name with page.frame()', async ({ page }) => {
    const frame = page.frame({ name: 'simple-frame' });
    expect(frame).not.toBeNull();
    await expect(frame!.locator('h2')).toHaveText('Inside the simple frame');
    expect(page.frame({ name: 'inner-frame' })?.url()).toContain('frame-inner.html');
  });

  test('srcdoc iframe', async ({ page }) => {
    const frame = page.frameLocator('iframe[title="Inline frame"]');
    await expect(frame.locator('#inline-text')).toHaveText('Hello from srcdoc');
    await frame.getByRole('button', { name: 'Click me' }).click();
    await expect(frame.getByRole('button', { name: 'Clicked!' })).toBeVisible();
  });

  test('shadow DOM is pierced by normal locators', async ({ page }) => {
    const card = page.getByTestId('user-card');
    await expect(card.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible();
    await card.getByLabel('Nickname').fill('Countess');
    await card.getByRole('button', { name: 'Greet' }).click();
    await expect(card.getByRole('status')).toHaveText('Hi Countess, welcome back!');
    // Plain CSS pierces open shadow roots as well.
    await expect(page.locator('user-card #greeting')).toHaveText('Hi Countess, welcome back!');
  });
});
