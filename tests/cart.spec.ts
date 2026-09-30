import { test, expect } from './fixtures';
import { seedCart } from './helpers';

test.describe('Cart', () => {
  test('empty cart shows the empty state', async ({ page }) => {
    await page.goto('pages/cart.html');
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
    await expect(page.getByTestId('cart-table')).toBeHidden();
  });

  test('lists items with line totals and order summary', async ({ page }) => {
    await seedCart(page, [{ id: 5, qty: 1 }, { id: 12, qty: 1 }]); // $39.90 + $12.50
    await page.goto('pages/cart.html');

    await expect(page.getByTestId('cart-row-5')).toContainText('Clean Code');
    await expect(page.getByTestId('line-total-5')).toHaveText('$39.90');
    await expect(page.getByTestId('subtotal')).toHaveText('$52.40');
    await expect(page.getByTestId('shipping')).toHaveText('$5.99');
    await expect(page.getByTestId('total')).toHaveText('$58.39');
    await expect(page.getByTestId('cart-count')).toHaveText('2');
  });

  test('+ and - buttons change quantity and totals', async ({ page }) => {
    await seedCart(page, [{ id: 5, qty: 1 }]);
    await page.goto('pages/cart.html');
    const decrease = page.getByRole('button', { name: 'Decrease quantity of Clean Code' });
    await expect(decrease).toBeDisabled();

    await page.getByRole('button', { name: 'Increase quantity of Clean Code' }).click();
    await expect(page.getByTestId('qty-5')).toHaveValue('2');
    await expect(page.getByTestId('line-total-5')).toHaveText('$79.80');
    await expect(page.getByTestId('cart-count')).toHaveText('2');

    await decrease.click();
    await expect(page.getByTestId('qty-5')).toHaveValue('1');
    await expect(decrease).toBeDisabled();
  });

  test('typing a quantity above the stock clamps it and explains why', async ({ page }) => {
    await seedCart(page, [{ id: 4, qty: 1 }]); // Smart Watch, stock 3
    await page.goto('pages/cart.html');
    await page.getByRole('spinbutton', { name: 'Quantity of Smart Watch' }).fill('10');
    await page.getByRole('spinbutton', { name: 'Quantity of Smart Watch' }).blur();
    await expect(page.getByTestId('qty-4')).toHaveValue('3');
    await expect(page.getByTestId('cart-message')).toHaveText('Only 3 of Smart Watch in stock.');
    await expect(page.getByRole('button', { name: 'Increase quantity of Smart Watch' })).toBeDisabled();
  });

  test('shipping is free from $100.00', async ({ page }) => {
    await seedCart(page, [{ id: 1, qty: 1 }]); // $79.99
    await page.goto('pages/cart.html');
    await expect(page.getByTestId('shipping')).toHaveText('$5.99');
    await expect(page.getByTestId('total')).toHaveText('$85.98');

    await page.getByRole('button', { name: 'Increase quantity of Wireless Headphones' }).click();
    await expect(page.getByTestId('subtotal')).toHaveText('$159.98');
    await expect(page.getByTestId('shipping')).toHaveText('Free');
    await expect(page.getByTestId('total')).toHaveText('$159.98');
  });

  test('SAVE10 gives 10% off', async ({ page }) => {
    await seedCart(page, [{ id: 2, qty: 1 }]); // $129.00
    await page.goto('pages/cart.html');
    await page.getByTestId('promo-code').fill('save10'); // case-insensitive
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-message')).toHaveText('Applied SAVE10: 10% off your order');
    await expect(page.getByTestId('discount')).toHaveText('-$12.90');
    await expect(page.getByTestId('total')).toHaveText('$116.10');

    await page.reload();
    await expect(page.getByTestId('total')).toHaveText('$116.10'); // promo persists
  });

  test('FREESHIP removes shipping', async ({ page }) => {
    await seedCart(page, [{ id: 12, qty: 2 }]); // $25.00
    await page.goto('pages/cart.html');
    await expect(page.getByTestId('total')).toHaveText('$30.99');
    await page.getByTestId('promo-code').fill('FREESHIP');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('shipping')).toHaveText('Free');
    await expect(page.getByTestId('total')).toHaveText('$25.00');
  });

  test('invalid and empty promo codes are rejected', async ({ page }) => {
    await seedCart(page, [{ id: 12, qty: 1 }]);
    await page.goto('pages/cart.html');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-message')).toHaveText('Enter a promo code.');

    await page.getByTestId('promo-code').fill('BOGUS');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-message')).toHaveText('Invalid promo code.');
    await expect(page.getByTestId('discount')).toBeHidden();
  });

  test('remove one item, then clear the cart', async ({ page }) => {
    await seedCart(page, [{ id: 5, qty: 1 }, { id: 12, qty: 1 }]);
    await page.goto('pages/cart.html');
    await page.getByRole('button', { name: 'Remove Clean Code' }).click();
    await expect(page.getByTestId('cart-row-5')).toHaveCount(0);
    await expect(page.getByTestId('subtotal')).toHaveText('$12.50');

    await page.reload();
    await expect(page.getByTestId('cart-row-12')).toBeVisible(); // persisted

    await page.getByTestId('clear-cart').click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });

  test('Reset data empties the cart', async ({ page }) => {
    await seedCart(page, [{ id: 5, qty: 1 }]);
    await page.goto('pages/cart.html');
    await expect(page.getByTestId('cart-row-5')).toBeVisible();
    await page.getByTestId('reset-data').click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });

  test('?fail=true shows an error', async ({ page }) => {
    await seedCart(page, [{ id: 5, qty: 1 }]);
    await page.goto('pages/cart.html?fail=true');
    await expect(page.getByTestId('cart-error')).toHaveText('Server error (500)');
  });
});
