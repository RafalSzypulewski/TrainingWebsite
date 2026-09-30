import { test, expect } from './fixtures';

test.describe('Main navigation', () => {
  test('groups open on click and close on Escape or outside click', async ({ page }) => {
    await page.goto('index.html');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const core = nav.getByRole('button', { name: 'Core' });
    const formsLink = nav.getByRole('link', { name: 'Forms' });

    await expect(core).toHaveAttribute('aria-expanded', 'false');
    await expect(formsLink).toBeHidden();

    await core.click();
    await expect(core).toHaveAttribute('aria-expanded', 'true');
    await expect(formsLink).toBeVisible();

    await page.keyboard.press('Escape');
    await page.mouse.move(0, 500); // hovering would keep it open
    await expect(formsLink).toBeHidden();
    await expect(core).toHaveAttribute('aria-expanded', 'false');

    await core.click();
    await page.getByRole('heading', { level: 1 }).click(); // click elsewhere
    await expect(formsLink).toBeHidden();
  });

  test('opening one group closes another', async ({ page }) => {
    await page.goto('index.html');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('button', { name: 'Core' }).click();
    await nav.getByRole('button', { name: 'Advanced' }).click();
    await expect(nav.getByRole('button', { name: 'Core' })).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Tricky' })).toBeVisible();
  });

  test('navigates to a page from a group and marks it as current', async ({ page }) => {
    await page.goto('index.html');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('button', { name: 'Intermediate' }).click();
    await nav.getByRole('link', { name: 'Windows & frames' }).click();
    await expect(page).toHaveURL(/pages\/windows\.html$/);

    await expect(nav.getByRole('button', { name: 'Intermediate' })).toHaveAttribute('data-active', 'true');
    await nav.getByRole('button', { name: 'Intermediate' }).click();
    await expect(nav.getByRole('link', { name: 'Windows & frames' })).toHaveAttribute('aria-current', 'page');
  });

  test('hover also opens a group', async ({ page }) => {
    await page.goto('index.html');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('button', { name: 'Advanced' }).hover();
    await expect(nav.getByRole('link', { name: 'Accessibility' })).toBeVisible();
  });

  test('every page in the menus loads', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('index.html');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const hrefs = await nav.locator('a').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs).toHaveLength(15);
    for (const href of hrefs) {
      const response = await page.request.get(href);
      expect(response.ok(), href).toBe(true);
    }
  });
});
