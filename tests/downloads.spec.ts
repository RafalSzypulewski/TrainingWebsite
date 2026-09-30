import { test, expect } from './fixtures';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Downloads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/downloads.html');
  });

  test('generated CSV: filename and contents', async ({ page }, testInfo) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('csv-btn').click();
    await expect(page.getByTestId('download-status')).toHaveText('Preparing employees.csv...');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('employees.csv');
    const target = testInfo.outputPath('employees.csv');
    await download.saveAs(target);

    const lines = fs.readFileSync(target, 'utf8').trim().split('\n');
    expect(lines[0]).toBe('id,name,email,department,role,salary,status,joined');
    expect(lines).toHaveLength(46); // header + 45 employees
    expect(lines[1]).toBe('1,Alice Anderson,alice.anderson@example.com,Engineering,Junior,4000,active,2018-01-01');
    await expect(page.getByTestId('download-status')).toContainText('Downloaded employees.csv');
  });

  test('?fail=true makes the export fail without a download', async ({ page }) => {
    await page.goto('pages/downloads.html?fail=true&delay=100');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await page.getByTestId('csv-btn').click();
    await expect(page.getByTestId('download-error')).toHaveText('Export failed: Server error (500)');
    expect(downloaded).toBe(false);
  });

  test('custom text file uses the given name and content', async ({ page }) => {
    await page.getByTestId('file-name').fill('my notes');
    await page.getByTestId('file-content').fill('Line 1\nLine 2');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('text-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('my_notes.txt');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString('utf8')).toBe('Line 1\nLine 2');
  });

  test('text form validates empty content', async ({ page }) => {
    await page.getByTestId('text-btn').click();
    await expect(page.getByText('Content is required')).toBeVisible();
    await expect(page.getByTestId('download-status')).toHaveText('No download started.');
  });

  test('static file download', async ({ page }, testInfo) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('static-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('sample-report.txt');
    const target = testInfo.outputPath('sample-report.txt');
    await download.saveAs(target);
    expect(fs.readFileSync(target, 'utf8')).toContain('Tests passed: 42');
  });

  test('JSON export includes stored browser data', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('demo', 'value'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my browser data (JSON)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('browser-data.json');
    const target = testInfo.outputPath('browser-data.json');
    await download.saveAs(target);
    expect(JSON.parse(fs.readFileSync(target, 'utf8')).localStorage.demo).toBe('value');
  });

  test('round trip: download the CSV, then import it', async ({ page }, testInfo) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('csv-btn').click();
    const target = path.join(testInfo.outputDir, 'employees.csv');
    await (await downloadPromise).saveAs(target);

    await page.getByTestId('csv-import').setInputFiles(target);
    await expect(page.getByTestId('import-summary')).toHaveText('Parsed 45 rows and 8 columns from employees.csv');
    const preview = page.getByTestId('import-preview-table');
    await expect(preview.locator('tbody tr')).toHaveCount(3);
    await expect(preview.getByRole('columnheader')).toHaveCount(8);
    await expect(preview.getByRole('cell', { name: 'Alice Anderson' })).toBeVisible();
  });
});
