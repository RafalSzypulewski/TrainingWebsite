import { test, expect } from '@playwright/test';
import { USERS, login } from './helpers';

test.describe('Login', () => {
  test('valid credentials land on the dashboard', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('welcome')).toHaveText('Welcome, student!');
    await expect(page.getByTestId('dashboard-role')).toHaveText('user');
    await expect(page.getByTestId('nav-user')).toContainText('student');
    await expect(page.getByTestId('admin-panel')).toBeHidden();
  });

  test('admin sees the admin panel', async ({ page }) => {
    await login(page, USERS.admin);
    await expect(page.getByTestId('admin-panel')).toBeVisible();
  });

  test('empty submit shows validation messages', async ({ page }) => {
    await page.goto('pages/login.html');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('pages/login.html');
    await page.getByLabel('Username').fill('student');
    await page.getByLabel('Password').fill('nope');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toHaveText('Invalid username or password');
  });

  test('locked account is rejected', async ({ page }) => {
    await page.goto('pages/login.html');
    await page.getByTestId('login-username').fill(USERS.locked.username);
    await page.getByTestId('login-password').fill(USERS.locked.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('locked');
  });

  test('show/hide password toggle switches the input type', async ({ page }) => {
    await page.goto('pages/login.html');
    const password = page.getByTestId('login-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('forgot password link has no test id but is reachable by role', async ({ page }) => {
    await page.goto('pages/login.html');
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });
});

test.describe('Protected page', () => {
  test('redirects to login when signed out, then returns after login', async ({ page }) => {
    await page.goto('pages/dashboard.html');
    await expect(page).toHaveURL(/login\.html\?reason=auth&redirect=dashboard\.html/);
    await expect(page.getByTestId('login-notice')).toHaveText('Please log in to view that page.');

    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/dashboard\.html$/);
    await expect(page.getByTestId('dashboard-title')).toBeVisible();
  });

  test('logout clears the session', async ({ page }) => {
    await login(page);
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/login\.html\?reason=logout/);
    await expect(page.getByTestId('login-notice')).toHaveText('You have been logged out.');
    await page.goto('pages/dashboard.html');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('logged-in users skip the login page', async ({ page }) => {
    await login(page);
    await page.goto('pages/login.html');
    await expect(page).toHaveURL(/dashboard\.html/);
  });
});

test.describe('Session storage', () => {
  test('without "remember me" the session lives in sessionStorage', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('dashboard-storage')).toHaveText('sessionStorage');
    expect(await page.evaluate(() => localStorage.getItem('pw_session'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('pw_session'))).toContain('student');
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'pw_session')?.value).toBe('student');
  });

  test('"remember me" persists the session in localStorage', async ({ page }) => {
    await login(page, USERS.student, true);
    await expect(page.getByTestId('dashboard-storage')).toHaveText('localStorage');
    expect(await page.evaluate(() => localStorage.getItem('pw_session'))).toContain('student');
  });

  test('a remembered session survives a new tab; a plain one does not', async ({ context, page }) => {
    await login(page, USERS.student, true);
    const second = await context.newPage();
    await second.goto('pages/dashboard.html');
    await expect(second.getByTestId('welcome')).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await login(page); // sessionStorage only
    const third = await context.newPage();
    await third.goto('pages/dashboard.html');
    await expect(third).toHaveURL(/login\.html/);
  });

  test('Reset data logs you out', async ({ page }) => {
    await login(page, USERS.student, true);
    await page.getByTestId('reset-data').click();
    await expect(page).toHaveURL(/login\.html/);
  });
});

test.describe('Query-param toggles', () => {
  test('?delay shows the spinner while signing in', async ({ page }) => {
    await page.goto('pages/login.html?delay=1500');
    await expect(page.getByTestId('active-toggles')).toContainText('delay=1500');
    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-spinner')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeDisabled();
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test('?fail=true shows a server error and re-enables the form', async ({ page }) => {
    await page.goto('pages/login.html?fail=true');
    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toHaveText('Server error (500)');
    await expect(page.getByTestId('login-spinner')).toBeHidden();
    await expect(page.getByTestId('login-submit')).toBeEnabled();
  });

  test('redirect param only allows local pages', async ({ page }) => {
    await page.goto('pages/login.html?redirect=https://evil.example/');
    await page.getByTestId('login-username').fill(USERS.student.username);
    await page.getByTestId('login-password').fill(USERS.student.password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/dashboard\.html/);
  });
});
