import { expect, type Page } from '@playwright/test';

export const USERS = {
  student: { username: 'student', password: 'Password123!' },
  admin: { username: 'admin', password: 'Admin123!' },
  locked: { username: 'locked', password: 'Locked123!' },
};

export async function login(page: Page, user = USERS.student, remember = false) {
  await page.goto('pages/login.html');
  await page.getByTestId('login-username').fill(user.username);
  await page.getByTestId('login-password').fill(user.password);
  if (remember) await page.getByTestId('login-remember').check();
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/dashboard\.html/);
}

/** Puts items straight into the cart's localStorage (skips the UI). */
export async function seedCart(page: Page, items: { id: number; qty: number }[], promo?: string) {
  await page.goto('pages/shop.html');
  await page.evaluate(([cart, code]) => {
    localStorage.setItem('pw_cart', JSON.stringify(cart));
    if (code) localStorage.setItem('pw_promo', code);
  }, [items, promo ?? ''] as const);
}

export async function fillCheckout(page: Page, card = '4242 4242 4242 4242') {
  await page.getByLabel('Full name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Address').fill('12 Analytical Way');
  await page.getByLabel('City').fill('London');
  await page.getByLabel('Postal code').fill('SW1A 1AA');
  await page.getByLabel('Country').selectOption('US');
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Expiry').fill('12/40');
  await page.getByLabel('CVC').fill('123');
}
