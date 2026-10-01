import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';

const rows = (page: Page) => page.getByTestId('employee-table').locator('tbody tr');
const column = (page: Page, index: number) => rows(page).locator(`td:nth-child(${index})`).allTextContents();
const NAME = 3;
const DEPARTMENT = 5;
const SALARY = 7;
const STATUS = 8;

test.describe('Tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/tables.html');
    await expect(rows(page)).toHaveCount(10);
  });

  test('first page shows 10 of 45 rows', { tag: '@smoke' }, async ({ page }) => {
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 45');
    await expect(page.getByTestId('page-prev')).toBeDisabled();
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('sort by name ascending then descending', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Name' });
    await page.getByRole('button', { name: 'Name' }).click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const asc = await column(page, NAME);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));

    await page.getByRole('button', { name: 'Name' }).click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    const desc = await column(page, NAME);
    expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a)));
  });

  test('salary sorts numerically, not alphabetically', async ({ page }) => {
    await page.getByRole('button', { name: 'Salary' }).click();
    const values = (await column(page, SALARY)).map((t) => Number(t.replace(/[$,]/g, '')));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values[0]).toBe(4000);
  });

  test('search filters rows and can be cleared', async ({ page }) => {
    await page.getByTestId('search').fill('alice');
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-5 of 5');
    for (const name of await column(page, NAME)) expect(name).toContain('Alice');

    await page.getByTestId('search').fill('');
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 45');
  });

  test('department and status filters combine', async ({ page }) => {
    await page.getByTestId('department-filter').selectOption('Engineering');
    await page.getByLabel('Status', { exact: true }).selectOption('inactive');
    const info = await page.getByTestId('range-info').textContent();
    const total = Number(info?.match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(45);
    for (const cell of await column(page, DEPARTMENT)) expect(cell).toBe('Engineering');
    for (const cell of await column(page, STATUS)) expect(cell).toBe('inactive');
  });

  test('empty state when nothing matches', async ({ page }) => {
    await page.getByTestId('search').fill('zzz-no-match');
    await expect(page.getByTestId('empty-state')).toHaveText('No employees match your filters.');
    await expect(page.getByTestId('range-info')).toHaveText('Showing 0 of 0');
  });

  test('pagination: next, page numbers, last page, page size', async ({ page }) => {
    await page.getByTestId('page-next').click();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 11-20 of 45');
    await expect(page.getByTestId('row-11')).toBeVisible();

    await page.getByRole('button', { name: '5', exact: true }).click();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 41-45 of 45');
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByTestId('page-next')).toBeDisabled();

    // Changing the page size goes back to the first page.
    await page.getByTestId('page-size').selectOption('25');
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-25 of 45');
    await expect(rows(page)).toHaveCount(25);
    await page.getByTestId('page-next').click();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 26-45 of 45');
    await expect(rows(page)).toHaveCount(20);
  });

  test('inline edit: cancel and save persist across reload', async ({ page }) => {
    await page.getByTestId('edit-1').click();
    await page.getByTestId('edit-input-1').fill('Alicia Anderson');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('row-1')).toContainText('Alice Anderson');

    await page.getByTestId('edit-1').click();
    await page.getByTestId('edit-input-1').fill('Alicia Anderson');
    await page.getByTestId('save-1').click();
    await expect(page.getByTestId('row-1')).toContainText('Alicia Anderson');

    await page.reload();
    await expect(page.getByTestId('row-1')).toContainText('Alicia Anderson');
  });

  test('toggle status by accessible name', async ({ page }) => {
    const row = page.getByRole('row', { name: /Alice Anderson/ });
    await expect(row.locator('.badge')).toHaveText('active');
    await row.getByRole('button', { name: 'Toggle status of Alice Anderson' }).click();
    await expect(row.locator('.badge')).toHaveText('inactive');
  });

  test('delete with inline confirmation persists until Reset data', async ({ page }) => {
    await page.getByTestId('delete-2').click();
    await expect(page.getByTestId('row-2')).toContainText('Delete Bob Anderson?');
    await page.getByRole('button', { name: 'No' }).click();
    await expect(page.getByTestId('row-2')).toContainText('Bob Anderson');

    await page.getByTestId('delete-2').click();
    await page.getByTestId('confirm-delete-2').click();
    await expect(page.getByTestId('row-2')).toHaveCount(0);
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 44');

    await page.reload();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 44');

    await page.getByTestId('reset-data').click();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 45');
    await expect(page.getByTestId('row-2')).toBeVisible();
  });

  test('select all on a page and delete in bulk', async ({ page }) => {
    await expect(page.getByTestId('delete-selected')).toBeDisabled();
    await page.getByTestId('select-all').check();
    await expect(page.getByTestId('selected-count')).toHaveText('10 selected');
    await page.getByRole('checkbox', { name: 'Select Bob Anderson' }).uncheck();
    await expect(page.getByTestId('selected-count')).toHaveText('9 selected');

    await page.getByTestId('delete-selected').click();
    await expect(page.getByTestId('range-info')).toHaveText('Showing 1-10 of 36');
    await expect(page.getByTestId('row-2')).toBeVisible();
    await expect(page.getByTestId('selected-count')).toHaveText('0 selected');
  });

  test('?fail=true shows an error instead of data', async ({ page }) => {
    await page.goto('pages/tables.html?fail=true');
    await expect(page.getByTestId('table-error')).toHaveText('Server error (500)');
    await expect(page.getByTestId('range-info')).toHaveText('Failed to load employees.');
  });
});
