import { test, expect } from '../support/fixtures';
import { seedCart, fillCheckout } from '../support/helpers';

test.describe('Checkout', () => {
  test('redirects to the cart when it is empty', async ({ page }) => {
    await page.goto('pages/checkout.html');
    await expect(page).toHaveURL(/cart\.html/);
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });

  test.describe('with items in the cart', () => {
    test.beforeEach(async ({ page }) => {
      await seedCart(page, [{ id: 12, qty: 1 }]); // Ceramic Mug $12.50
      await page.goto('pages/checkout.html');
      await expect(page.getByTestId('summary-items')).toContainText('1 × Ceramic Mug');
    });

    test('empty submit reports every required field', async ({ page }) => {
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('form-summary')).toHaveText('Please fix 9 errors before placing your order.');
      for (const msg of ['Full name is required', 'Email is required', 'Address is required', 'City is required',
        'Postal code is required', 'Please select a country', 'Card number is required',
        'Expiry date is required', 'CVC is required']) {
        await expect(page.getByText(msg)).toBeVisible();
      }
    });

    test('field-level payment validation', async ({ page }) => {
      await page.getByLabel('Email').fill('nope');
      await page.getByLabel('Card number').fill('4242 4242');
      await page.getByLabel('Expiry').fill('13/30');
      await page.getByLabel('CVC').fill('12');
      await page.getByTestId('place-order').click();
      await expect(page.getByText('Enter a valid email address')).toBeVisible();
      await expect(page.getByText('Card number must be 16 digits')).toBeVisible();
      await expect(page.getByText('Use the format MM/YY')).toBeVisible();
      await expect(page.getByText('CVC must be 3 digits')).toBeVisible();

      await page.getByLabel('Expiry').fill('01/20');
      await expect(page.getByText('Card has expired')).toBeVisible();
      await page.getByLabel('Expiry').fill('12/40');
      await expect(page.getByText('Card has expired')).toBeHidden();
    });

    test('express shipping changes the total', async ({ page }) => {
      await expect(page.getByTestId('shipping')).toHaveText('$5.99');
      await expect(page.getByTestId('total')).toHaveText('$18.49');
      await page.getByTestId('method-express').check();
      await expect(page.getByTestId('shipping')).toHaveText('$9.99');
      await expect(page.getByTestId('total')).toHaveText('$22.49');
    });

    test('successful order shows the confirmation and clears the cart', async ({ page }) => {
      await fillCheckout(page);
      await page.getByTestId('place-order').click();

      await expect(page).toHaveURL(/confirmation\.html\?order=ORD-1001/);
      await expect(page.getByTestId('thanks')).toHaveText('Thank you, Ada Lovelace!');
      await expect(page.getByTestId('order-number')).toHaveText('ORD-1001');
      await expect(page.getByTestId('order-items')).toContainText('1 × Ceramic Mug');
      await expect(page.getByTestId('order-total')).toHaveText('$18.49');
      await expect(page.getByTestId('order-address')).toContainText('12 Analytical Way');
      await expect(page.getByText('Card ending in 4242')).toBeVisible();
      await expect(page.getByTestId('cart-count')).toHaveText('0');

      await page.reload();
      await expect(page.getByTestId('order-number')).toHaveText('ORD-1001');
    });

    test('a declined card keeps the cart and stays on checkout', async ({ page }) => {
      await fillCheckout(page, '4000 0000 0000 0002');
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('checkout-error')).toHaveText('Your card was declined.');
      await expect(page).toHaveURL(/checkout\.html/);
      await expect(page.getByTestId('cart-count')).toHaveText('1');
      await expect(page.getByTestId('place-order')).toBeEnabled();

      await page.getByLabel('Card number').fill('4242 4242 4242 4242');
      await page.getByTestId('place-order').click();
      await expect(page).toHaveURL(/confirmation\.html/);
    });

    test('?delay shows a spinner while the order is placed', async ({ page }) => {
      await page.goto('pages/checkout.html?delay=1200');
      await fillCheckout(page);
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('order-spinner')).toBeVisible();
      await expect(page.getByTestId('place-order')).toBeDisabled();
      await expect(page).toHaveURL(/confirmation\.html/);
    });

    test('?fail=true shows a payment error', async ({ page }) => {
      await page.goto('pages/checkout.html?fail=true&delay=100');
      await fillCheckout(page);
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('checkout-error')).toContainText('Payment service unavailable');
      await expect(page.getByTestId('cart-count')).toHaveText('1');
    });
  });
});

test.describe('Confirmation', () => {
  test('unknown order shows not found', async ({ page }) => {
    await page.goto('pages/confirmation.html?order=ORD-9999');
    await expect(page.getByTestId('order-not-found')).toBeVisible();
  });

  test('order numbers increment', async ({ page }) => {
    for (const expected of ['ORD-1001', 'ORD-1002']) {
      await seedCart(page, [{ id: 12, qty: 1 }]);
      await page.goto('pages/checkout.html');
      await fillCheckout(page);
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('order-number')).toHaveText(expected);
    }
  });
});

test('end-to-end purchase through the UI with a promo code', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('pages/shop.html');
  await page.getByTestId('category-filter').selectOption('Books');
  await page.getByTestId('add-5').click(); // Clean Code $39.90
  await page.getByTestId('add-6').click(); // Pragmatic Programmer $44.95
  await expect(page.getByTestId('cart-count')).toHaveText('2');

  await page.getByRole('link', { name: 'Shopping cart' }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$84.85');
  await page.getByTestId('promo-code').fill('SAVE10');
  await page.getByTestId('promo-apply').click();
  await expect(page.getByTestId('discount')).toHaveText('-$8.49'); // 10% of 84.85, rounded
  await expect(page.getByTestId('total')).toHaveText('$82.35'); // 84.85 - 8.49 + 5.99

  await page.getByTestId('checkout-link').click();
  await expect(page.getByTestId('total')).toHaveText('$82.35');
  await fillCheckout(page);
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('order-number')).toHaveText('ORD-1001');
  await expect(page.getByTestId('order-total')).toHaveText('$82.35');
  await expect(page.getByTestId('order-items')).toContainText('Clean Code');
  await expect(page.getByTestId('order-items')).toContainText('The Pragmatic Programmer');
});
