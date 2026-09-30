import { test, expect, type Page } from '@playwright/test';

const cards = (page: Page) => page.getByTestId('product-grid').locator('article');
const prices = async (page: Page) =>
  (await page.locator('[data-testid^="price-"]').allTextContents()).map((t) => Number(t.replace('$', '')));

test.describe('Shop catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/shop.html');
    await expect(cards(page)).toHaveCount(12);
  });

  test('loads all products', async ({ page }) => {
    await expect(page.getByTestId('result-count')).toHaveText('12 products');
    await expect(page.getByRole('heading', { name: 'Mechanical Keyboard' })).toBeVisible();
    await expect(page.getByTestId('price-2')).toHaveText('$129.00');
  });

  test('search narrows results and shows an empty state', async ({ page }) => {
    await page.getByTestId('search').fill('keyboard');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByTestId('result-count')).toHaveText('1 product');

    await page.getByTestId('search').fill('no-such-thing');
    await expect(page.getByTestId('no-results')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await page.getByTestId('search').fill('');
    await expect(cards(page)).toHaveCount(12);
  });

  test('category filter', async ({ page }) => {
    await page.getByTestId('category-filter').selectOption('Books');
    await expect(cards(page)).toHaveCount(3);
    for (const badge of await cards(page).locator('.badge').allTextContents()) expect(badge).toBe('Books');
  });

  test('sort by price ascending and descending', async ({ page }) => {
    await page.getByTestId('sort').selectOption('price-asc');
    let values = await prices(page);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values[0]).toBe(12.5);

    await page.getByTestId('sort').selectOption('price-desc');
    values = await prices(page);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(values[0]).toBe(199.99);
  });

  test('sort by name', async ({ page }) => {
    await page.getByTestId('sort').selectOption('name');
    await expect(cards(page).first().getByRole('heading')).toHaveText('Ceramic Mug');
  });

  test('max price slider', async ({ page }) => {
    await page.getByLabel(/Max price/).fill('50');
    await expect(page.getByTestId('max-price-output')).toHaveText('$50');
    await expect(cards(page)).toHaveCount(7);
    for (const price of await prices(page)) expect(price).toBeLessThanOrEqual(50);
  });

  test('in-stock filter hides the sold-out product', async ({ page }) => {
    await expect(page.getByTestId('stock-3')).toHaveText('Out of stock');
    await expect(page.getByTestId('add-3')).toBeDisabled();

    await page.getByTestId('in-stock').check();
    await expect(cards(page)).toHaveCount(11);
    await expect(page.getByTestId('product-3')).toHaveCount(0);
  });

  test('filters can be preset through the URL', async ({ page }) => {
    await page.goto('pages/shop.html?category=Books&q=clean');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Clean Code' })).toBeVisible();
  });

  test('adding to cart updates the header count and shows a toast', async ({ page }) => {
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    await page.getByTestId('add-5').click();
    await expect(page.getByTestId('toast')).toHaveText('Added Clean Code to cart');
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.getByTestId('product-12').getByRole('button', { name: 'Add to cart' }).click();
    await page.getByTestId('add-12').click();
    await expect(page.getByTestId('cart-count')).toHaveText('3');

    await page.reload();
    await expect(page.getByTestId('cart-count')).toHaveText('3');
  });

  test('cannot add more than the stock', async ({ page }) => {
    for (let i = 0; i < 4; i++) await page.getByTestId('add-4').click();
    await expect(page.getByTestId('cart-count')).toHaveText('3');
    await expect(page.getByTestId('toast').last()).toHaveText('Only 3 of Smart Watch in stock');
  });

  test('card link opens the product page', async ({ page }) => {
    await page.getByTestId('product-2').getByRole('link', { name: 'Mechanical Keyboard' }).last().click();
    await expect(page).toHaveURL(/product\.html\?id=2/);
    await expect(page.getByTestId('product-name')).toHaveText('Mechanical Keyboard');
  });
});

test.describe('Shop loading and errors', () => {
  test('?delay shows a loading message first', async ({ page }) => {
    await page.goto('pages/shop.html?delay=1000');
    await expect(page.getByTestId('result-count')).toHaveText('Loading products...');
    await expect(page.getByTestId('result-count')).toHaveText('12 products');
  });

  test('?fail=true shows an error with Retry', async ({ page }) => {
    await page.goto('pages/shop.html?fail=true&delay=100');
    await expect(page.getByTestId('shop-error')).toContainText('Server error (500)');
    await expect(page.getByTestId('result-count')).toHaveText('Products could not be loaded.');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('shop-error')).toBeVisible();
  });
});

test.describe('Product page', () => {
  test('shows details', async ({ page }) => {
    await page.goto('pages/product.html?id=2');
    await expect(page.getByTestId('product-name')).toHaveText('Mechanical Keyboard');
    await expect(page.getByTestId('product-price')).toHaveText('$129.00');
    await expect(page.getByTestId('product-stock')).toHaveText('8 in stock');
    await expect(page).toHaveTitle(/Mechanical Keyboard/);
  });

  test('add a quantity of 2 and go to the cart', async ({ page }) => {
    await page.goto('pages/product.html?id=2');
    await page.getByTestId('product-qty').fill('2');
    await page.getByTestId('product-add').click();
    await expect(page.getByTestId('product-message')).toHaveText('Added 2 x Mechanical Keyboard to your cart.');
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await page.getByRole('link', { name: 'Go to cart' }).click();
    await expect(page).toHaveURL(/cart\.html/);
    await expect(page.getByTestId('qty-2')).toHaveValue('2');
  });

  test('validates quantity against the stock', async ({ page }) => {
    await page.goto('pages/product.html?id=2');
    await page.getByTestId('product-qty').fill('9');
    await page.getByTestId('product-add').click();
    await expect(page.getByTestId('product-message')).toHaveText('Only 8 in stock.');

    await page.getByTestId('product-qty').fill('0');
    await page.getByTestId('product-add').click();
    await expect(page.getByTestId('product-message')).toHaveText('Enter a quantity of at least 1.');
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });

  test('sold-out product cannot be added', async ({ page }) => {
    await page.goto('pages/product.html?id=3');
    await expect(page.getByTestId('product-stock')).toHaveText('Out of stock');
    await expect(page.getByTestId('product-add')).toBeDisabled();
  });

  test('unknown product shows not found', async ({ page }) => {
    await page.goto('pages/product.html?id=999');
    await expect(page.getByTestId('product-error')).toHaveText('Product not found.');
  });
});
