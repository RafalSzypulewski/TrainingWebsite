import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/accessibility.html');
  });

  test('axe finds no violations in the good section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#good').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });

  test('axe flags the expected problems in the bad section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#bad').analyze();
    const ids = results.violations.map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['label', 'button-name', 'image-alt', 'link-name', 'color-contrast']));
  });

  test.describe('good markup is reachable by role and label', () => {
    test('form controls, buttons and images', async ({ page }) => {
      const good = page.getByTestId('good-section');
      await expect(good.getByRole('heading', { name: 'Good markup' })).toBeVisible();
      await expect(good.getByLabel('Email address')).toBeVisible();
      await expect(good.getByRole('button', { name: 'Subscribe' })).toBeVisible();
      await expect(good.getByRole('button', { name: 'Add to favourites' })).toBeVisible();
      await expect(good.getByRole('img', { name: 'Stack of programming books' })).toBeVisible();
      await expect(good.getByRole('link', { name: 'Read the full accessibility guide' })).toBeVisible();
    });

    test('validation errors are announced', async ({ page }) => {
      const email = page.getByLabel('Email address');
      await page.getByRole('button', { name: 'Subscribe' }).click();
      await expect(page.getByRole('alert')).toHaveText('Email is required');
      await expect(email).toHaveAttribute('aria-invalid', 'true');
      await expect(email).toBeFocused();
      await expect(email).toHaveAccessibleDescription(/never share it/);

      await email.fill('not-an-email');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('alert')).toHaveText('Enter a valid email address');

      await email.fill('ada@example.com');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText('Subscribed ada@example.com');
      await expect(email).toHaveAttribute('aria-invalid', 'false');
    });

    test('accordion works with the keyboard and exposes its state', async ({ page }) => {
      const button = page.getByRole('button', { name: 'Shipping information' }).first();
      const panel = page.getByRole('region', { name: 'Shipping information' });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).toBeHidden();

      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toHaveText('Orders ship within two business days.');

      await page.keyboard.press('Space');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).toBeHidden();
    });

    test('tabs support arrow-key navigation', async ({ page }) => {
      const tabs = page.getByRole('tablist', { name: 'Product information' });
      const description = tabs.getByRole('tab', { name: 'Description' });
      const reviews = tabs.getByRole('tab', { name: 'Reviews' });

      await expect(description).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel')).toHaveText('A sturdy ceramic mug.');

      await description.focus();
      await page.keyboard.press('ArrowRight');
      await expect(reviews).toBeFocused();
      await expect(reviews).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel')).toHaveText('Rated 4.5 by 120 customers.');

      await page.keyboard.press('ArrowRight'); // wraps around
      await expect(description).toBeFocused();
      await page.keyboard.press('End');
      await expect(reviews).toHaveAttribute('aria-selected', 'true');
    });

    test('tab order follows the visual order', async ({ page }) => {
      await page.getByLabel('Email address').focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Subscribe' }).first()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Add to favourites' })).toBeFocused();
    });

    test('aria snapshot of the form', async ({ page }) => {
      await expect(page.locator('#good-form')).toMatchAriaSnapshot(`
        - textbox "Email address"
        - button "Subscribe"
      `);
    });
  });

  test.describe('bad markup defeats semantic locators', () => {
    test('no role or label locators match', async ({ page }) => {
      const bad = page.getByTestId('bad-section');
      await expect(bad.getByRole('button', { name: 'Subscribe' })).toHaveCount(0);
      await expect(bad.getByLabel('Email address')).toHaveCount(0); // the text is not associated with the input
      await expect(bad.getByRole('img', { name: /books/i })).toHaveCount(0);
      await expect(bad.getByAltText(/.+/)).toHaveCount(0);
      await expect(bad.getByRole('textbox')).toHaveCount(1); // exists, but has no accessible name
      await expect(bad.getByRole('tab')).toHaveCount(0);
      await expect(bad.getByRole('heading', { name: 'Bad markup' })).toHaveCount(0);
    });

    test('text, unnamed role and CSS locators still work', async ({ page }) => {
      const bad = page.getByTestId('bad-section');
      await bad.getByRole('textbox').fill('ada@example.com');
      await bad.getByText('Subscribe').click();
      await expect(page.locator('#bad-status')).toHaveText('Subscribed ada@example.com');
    });

    test('the div "button" cannot be focused or used from the keyboard', async ({ page }) => {
      await page.locator('#bad-email').fill('ada@example.com');
      await page.getByTestId('bad-submit').focus();
      await expect(page.getByTestId('bad-submit')).not.toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#bad-status')).toHaveText('');
    });

    test('fake accordion and tabs only work with the mouse', async ({ page }) => {
      await page.getByTestId('bad-acc-btn').click();
      await expect(page.locator('#bad-acc-panel')).toBeVisible();

      await page.locator('.fake-tab', { hasText: 'Reviews' }).click();
      await expect(page.locator('#bad-panel-reviews')).toBeVisible();
      await expect(page.locator('#bad-panel-desc')).toBeHidden();
    });

    test('low contrast is visible to the eye but flagged by axe', async ({ page }) => {
      await expect(page.getByTestId('low-contrast')).toBeVisible();
      await expect(page.getByTestId('low-contrast')).toHaveCSS('color', 'rgb(179, 179, 179)');
    });
  });
});
