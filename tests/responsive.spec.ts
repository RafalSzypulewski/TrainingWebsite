import { test, expect, type Page } from '@playwright/test';

const columns = (page: Page) =>
  page.getByTestId('resp-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

const SIZES = {
  mobile: { width: 375, height: 800 },
  tablet: { width: 800, height: 900 },
  desktop: { width: 1280, height: 900 },
};

test.describe('Responsive layout by viewport', () => {
  test('mobile', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile);
    await page.goto('pages/responsive.html');

    await expect(page.getByTestId('env-breakpoint')).toHaveText('mobile');
    await expect(page.getByTestId('env-viewport')).toHaveText('375 x 800');
    await expect(page.getByTestId('mobile-only')).toBeVisible();
    await expect(page.getByTestId('desktop-only')).toBeHidden();
    expect(await columns(page)).toBe(1);

    // Collapsing menu
    const toggle = page.getByTestId('demo-toggle');
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId('demo-menu')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('demo-menu').getByRole('link')).toHaveText(['Home', 'Products', 'About', 'Contact']);
    await toggle.click();
    await expect(page.getByTestId('demo-menu')).toBeHidden();

    // Table turns into stacked cards with data labels
    const row = page.getByTestId('resp-table').locator('tbody tr').first();
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('block');
    await expect(row.locator('td').first()).toHaveAttribute('data-label', 'Plan');
    await expect(page.getByTestId('resp-table').locator('thead')).not.toBeInViewport();
  });

  test('tablet', async ({ page }) => {
    await page.setViewportSize(SIZES.tablet);
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-breakpoint')).toHaveText('tablet');
    await expect(page.getByTestId('demo-toggle')).toBeHidden();
    await expect(page.getByTestId('demo-menu')).toBeVisible();
    await expect(page.getByTestId('desktop-only')).toBeVisible();
    await expect(page.getByTestId('mobile-only')).toBeHidden();
    expect(await columns(page)).toBe(2);
    const row = page.getByTestId('resp-table').locator('tbody tr').first();
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('table-row');
  });

  test('desktop', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop);
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-breakpoint')).toHaveText('desktop');
    expect(await columns(page)).toBe(3);
    await expect(page.getByTestId('demo-toggle')).toBeHidden();
  });

  test('resizing live updates the layout without reloading', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop);
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-breakpoint')).toHaveText('desktop');

    await page.setViewportSize(SIZES.tablet);
    await expect(page.getByTestId('env-breakpoint')).toHaveText('tablet');
    await expect.poll(() => columns(page)).toBe(2);

    await page.setViewportSize(SIZES.mobile);
    await expect(page.getByTestId('env-breakpoint')).toHaveText('mobile');
    await expect(page.getByTestId('demo-toggle')).toBeVisible();
  });

  test('the breakpoint edges', async ({ page }) => {
    await page.goto('pages/responsive.html');
    for (const [width, expected] of [[639, 'mobile'], [640, 'tablet'], [1023, 'tablet'], [1024, 'desktop']] as const) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByTestId('env-breakpoint')).toHaveText(expected);
    }
  });

  test('the <picture> source depends on the width', async ({ page }) => {
    const current = () => page.getByTestId('resp-image').evaluate((img: HTMLImageElement) => img.currentSrc);
    await page.setViewportSize(SIZES.desktop);
    await page.goto('pages/responsive.html');
    await expect.poll(current).toContain('electronics.svg');
    await page.setViewportSize(SIZES.tablet);
    await expect.poll(current).toContain('books.svg');
    await page.setViewportSize(SIZES.mobile);
    await expect.poll(current).toContain('home.svg');
  });
});

test.describe('Mouse device', () => {
  test('hover reveals a tip and the input is "mouse"', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop);
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-input')).toHaveText('mouse');
    const tip = page.getByRole('note');
    await expect(tip).toBeHidden();
    await page.getByTestId('tip-box').hover();
    await expect(tip).toBeVisible();
    await expect(page.getByTestId('hover-hint')).toBeVisible();
  });
});

test.describe('Touch phone emulation', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('detects touch, hides hover-only content and supports tap', async ({ page }) => {
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-breakpoint')).toHaveText('mobile');
    await expect(page.getByTestId('env-input')).toHaveText('touch');
    await expect(page.getByTestId('hover-hint')).toBeHidden();

    await page.getByTestId('demo-toggle').tap();
    await expect(page.getByTestId('demo-menu')).toBeVisible();

    const box = await page.getByTestId('touch-target').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48); // comfortable tap target
  });
});

test.describe('Media feature emulation', () => {
  test.describe('dark + reduced motion', () => {
    test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

    test('reports the emulated preferences', async ({ page }) => {
      await page.goto('pages/responsive.html');
      await expect(page.getByTestId('env-scheme')).toHaveText('dark');
      await expect(page.getByTestId('env-motion')).toHaveText('reduce');
      await expect(page.getByTestId('env')).toHaveCSS('background-color', 'rgb(30, 27, 75)');
    });

    test('can be switched while the page is open', async ({ page }) => {
      await page.goto('pages/responsive.html');
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
      await expect(page.getByTestId('env-scheme')).toHaveText('light');
      await expect(page.getByTestId('env-motion')).toHaveText('no-preference');
    });
  });

  test('landscape vs portrait', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 500 });
    await page.goto('pages/responsive.html');
    await expect(page.getByTestId('env-orientation')).toHaveText('landscape');
    await page.setViewportSize({ width: 500, height: 900 });
    await expect(page.getByTestId('env-orientation')).toHaveText('portrait');
  });
});
