import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const png = { name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') };

async function fillValid(page: Page) {
  await page.getByTestId('full-name').fill('Ada Lovelace');
  await page.getByTestId('email').fill('ada@example.com');
  await page.getByTestId('password').fill('Secret123');
  await page.getByTestId('confirm-password').fill('Secret123');
  await page.getByTestId('age').fill('36');
  await page.getByLabel('Phone').fill('+48 123 456 789');
  await page.getByLabel('Website').fill('https://ada.example.com');
  await page.getByTestId('birthdate').fill('1990-12-10');
  await page.getByLabel('Preferred call time').fill('14:30');
  await page.getByLabel('Favourite colour').fill('#ff0000');
  await page.getByTestId('range').fill('8');
  await page.getByLabel('Favourite language').fill('TypeScript');
  await page.getByTestId('country').selectOption('pl');
  await page.getByTestId('skills').selectOption(['ts', 'css']);
  await page.getByRole('radio', { name: 'Business' }).check();
  await page.getByTestId('interest-testing').check();
  await page.getByLabel('Design').check();
  await page.getByTestId('bio').fill('Analytical engine enthusiast');
  await page.getByLabel('I accept the terms and conditions *').check();
}

test.describe('Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/forms.html');
  });

  test('empty submit lists every required-field error', async ({ page }) => {
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('form-summary')).toHaveText('Please fix 8 errors before submitting.');
    for (const msg of [
      'Full name is required',
      'Email is required',
      'Password is required',
      'Age is required',
      'Birth date is required',
      'Please select a country',
      'Please choose an account type',
      'You must accept the terms',
    ]) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    await expect(page.getByTestId('result-panel')).toBeHidden();
  });

  test('valid submission shows the collected data', async ({ page }) => {
    await fillValid(page);
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('success-message')).toBeVisible();
    const data = JSON.parse((await page.getByTestId('result-json').textContent()) ?? '{}');
    expect(data).toMatchObject({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password: '********',
      age: '36',
      birthdate: '1990-12-10',
      appointment: '14:30',
      favColor: '#ff0000',
      satisfaction: '8',
      language: 'TypeScript',
      country: 'pl',
      skills: expect.arrayContaining(['ts', 'css']),
      gender: 'business',
      interests: ['testing', 'design'],
      terms: true,
    });
    expect(data.confirmPassword).toBeUndefined();
  });

  test('field-level validation rules', async ({ page }) => {
    await page.getByTestId('full-name').fill('A');
    await page.getByTestId('email').fill('not-an-email');
    await page.getByTestId('password').fill('short');
    await page.getByTestId('age').fill('17');
    await page.getByLabel('Phone').fill('abc');
    await page.getByLabel('Website').fill('ftp://x');
    await page.getByTestId('birthdate').fill('2999-01-01');
    await page.getByTestId('submit').click();

    await expect(page.getByText('Full name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters and include a number')).toBeVisible();
    await expect(page.getByText('Age must be between 18 and 99')).toBeVisible();
    await expect(page.getByText('Enter a valid phone number')).toBeVisible();
    await expect(page.getByText('Website must start with http:// or https://')).toBeVisible();
    await expect(page.getByText('Birth date cannot be in the future')).toBeVisible();
  });

  test('password mismatch error clears once fixed', async ({ page }) => {
    await page.getByTestId('password').fill('Secret123');
    await page.getByTestId('confirm-password').fill('Different1');
    await page.getByTestId('submit').click();
    const error = page.locator('#confirmPassword-error');
    await expect(error).toHaveText('Passwords do not match');

    await page.getByTestId('confirm-password').fill('Secret123');
    await expect(error).toBeHidden();
    await expect(page.getByTestId('confirm-password')).toHaveAttribute('aria-invalid', 'false');
  });

  test('range slider and bio counter update live', async ({ page }) => {
    await page.getByTestId('range').fill('3');
    await expect(page.getByTestId('range-output')).toHaveText('3');

    await page.getByTestId('bio').fill('hello');
    await expect(page.getByTestId('bio-count')).toHaveText('5/200');

    await page.getByTestId('bio').fill('x'.repeat(201));
    await page.getByTestId('submit').click();
    await expect(page.getByText('Bio must be at most 200 characters')).toBeVisible();
  });

  test('avatar upload: valid image and invalid type', async ({ page }) => {
    await page.getByTestId('avatar').setInputFiles(png);
    await expect(page.locator('#avatar-error')).toBeHidden();

    await page.getByTestId('avatar').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByText('Avatar must be a PNG or JPG image')).toBeVisible();

    await page.getByTestId('avatar').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(1024 * 1024 + 1) });
    await expect(page.getByText('Avatar must be smaller than 1 MB')).toBeVisible();
  });

  test('documents upload: list, limit and removal', async ({ page }) => {
    const doc = (n: number) => ({ name: `doc${n}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`doc ${n}`) });
    const input = page.getByTestId('documents');

    await input.setInputFiles([doc(1), doc(2)]);
    await expect(page.getByTestId('documents-list').getByRole('listitem')).toHaveText(['doc1.txt', 'doc2.txt']);

    await input.setInputFiles([doc(1), doc(2), doc(3), doc(4)]);
    await expect(page.getByText('You can upload at most 3 documents')).toBeVisible();

    await input.setInputFiles([]);
    await expect(page.getByTestId('documents-list').getByRole('listitem')).toHaveCount(0);
    await expect(page.locator('#documents-error')).toBeHidden();
  });

  test('uploaded file names appear in the result', async ({ page }) => {
    await fillValid(page);
    await page.getByTestId('avatar').setInputFiles(png);
    await page.getByTestId('documents').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('result-json')).toContainText('"avatar": "avatar.png"');
    await expect(page.getByTestId('result-json')).toContainText('cv.pdf');
  });

  test('"Clear form" resets fields and errors', async ({ page }) => {
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('form-summary')).toBeVisible();
    await page.getByRole('button', { name: 'Clear form' }).click();
    await expect(page.getByTestId('form-summary')).toBeHidden();
    await expect(page.getByText('Full name is required')).toBeHidden();
  });

  test('?delay shows a spinner while submitting', async ({ page }) => {
    await page.goto('pages/forms.html?delay=1500');
    await fillValid(page);
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('form-spinner')).toBeVisible();
    await expect(page.getByTestId('submit')).toBeDisabled();
    await expect(page.getByTestId('success-message')).toBeVisible();
    await expect(page.getByTestId('form-spinner')).toBeHidden();
  });

  test('?fail=true shows a server error and no result', async ({ page }) => {
    await page.goto('pages/forms.html?fail=true');
    await fillValid(page);
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('form-server-error')).toContainText('Server error (500)');
    await expect(page.getByTestId('result-panel')).toBeHidden();
  });
});

test.describe('Newsletter form (native validation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/forms.html');
  });

  test('browser blocks an empty submit with a validation message', async ({ page }) => {
    await page.getByRole('button', { name: 'Subscribe' }).click();
    const email = page.getByLabel('Email', { exact: true }).and(page.locator('#news-email'));
    expect(await email.evaluate((el: HTMLInputElement) => el.validationMessage)).not.toBe('');
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await expect(page.getByTestId('newsletter-status')).toBeEmpty();
  });

  test('pattern mismatch and successful subscribe', async ({ page }) => {
    await page.locator('#news-email').fill('ada@example.com');
    await page.locator('#news-code').fill('abc-1');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    expect(await page.locator('#news-code').evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);

    await page.locator('#news-code').fill('ABC-123');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByTestId('newsletter-status')).toHaveText('Subscribed ada@example.com with code ABC-123');
  });
});
