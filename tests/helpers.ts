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
