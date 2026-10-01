import { test, expect } from '../support/fixtures';

test.describe('Mouse and keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('pages/mouse.html');
  });

  test('hover shows and hides a message', async ({ page }) => {
    const message = page.getByTestId('hover-message');
    await expect(message).toBeHidden();
    await page.getByTestId('hover-target').hover();
    await expect(message).toBeVisible();
    await page.getByRole('heading', { name: 'Mouse & keyboard' }).hover();
    await expect(message).toBeHidden();
  });

  test('hover menu reveals submenu items', async ({ page }) => {
    const item = page.getByTestId('menu-laptops');
    await expect(item).toBeHidden();
    await page.getByRole('button', { name: 'Products' }).hover();
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/#laptops$/);
  });

  test('single, double, right and modifier clicks', async ({ page }) => {
    const pad = page.getByTestId('click-pad');

    await pad.click();
    await expect(page.getByTestId('click-count')).toHaveText('1');
    await expect(page.getByTestId('last-event')).toHaveText('click');

    await pad.dblclick(); // two clicks + a dblclick
    await expect(page.getByTestId('dblclick-count')).toHaveText('1');
    await expect(page.getByTestId('click-count')).toHaveText('3');

    await pad.click({ button: 'right' });
    await expect(page.getByTestId('context-count')).toHaveText('1');
    await expect(page.getByTestId('last-event')).toHaveText('contextmenu');

    await pad.click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('last-event')).toHaveText('shift+click');
  });

  test('custom context menu', async ({ page }) => {
    const menu = page.getByRole('menu');
    await expect(menu).toBeHidden();
    await page.getByTestId('context-area').click({ button: 'right' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Rename' }).click();
    await expect(page.getByTestId('context-result')).toHaveText('Context action: Rename');
    await expect(menu).toBeHidden();

    await page.getByTestId('context-area').click({ button: 'right' });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('drag and drop between lists', async ({ page }) => {
    const todo = page.getByTestId('zone-todo');
    const done = page.getByTestId('zone-done');

    await page.getByTestId('task-1').dragTo(done);
    await expect(done.getByText('Write tests')).toBeVisible();
    await expect(todo.getByText('Write tests')).toHaveCount(0);
    await expect(page.getByTestId('dnd-status')).toHaveText('Moved "Write tests" to Done');

    await done.getByText('Write tests').dragTo(todo);
    await expect(todo.getByRole('listitem')).toHaveCount(3);
    await expect(done.getByRole('listitem')).toHaveCount(0);
  });

  test('slider: keyboard', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Volume' });
    await expect(slider).toHaveAttribute('aria-valuenow', '25');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('slider-value')).toHaveText('30');
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  test('slider: mouse click and drag', async ({ page }) => {
    const slider = page.getByTestId('slider');
    await slider.scrollIntoViewIfNeeded(); // mouse coordinates are viewport-relative
    const box = (await slider.boundingBox())!;
    const at = (pct: number) => ({ x: box.x + (box.width * pct) / 100, y: box.y + box.height / 2 });

    await page.mouse.click(at(80).x, at(80).y);
    await expect(page.getByTestId('slider-value')).toHaveText('80');

    await page.mouse.move(at(80).x, at(80).y);
    await page.mouse.down();
    await page.mouse.move(at(40).x, at(40).y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId('slider-value')).toHaveText('40');
  });

  test('key events report key, code and modifiers', async ({ page }) => {
    const input = page.getByTestId('key-input');
    const info = page.getByTestId('key-info');

    await input.press('a');
    await expect(info).toHaveText('Key: a | Code: KeyA');
    await input.press('Enter');
    await expect(info).toHaveText('Key: Enter | Code: Enter');
    await input.press('ArrowLeft');
    await expect(info).toHaveText('Key: ArrowLeft | Code: ArrowLeft');
    await input.press('Shift+A');
    await expect(info).toHaveText('Key: A | Code: KeyA | Modifiers: Shift');
    await input.press('Control+Alt+x');
    await expect(info).toContainText('Modifiers: Ctrl+Alt');
  });

  test('Ctrl+K shortcut works anywhere', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('shortcut-status')).toHaveText('Shortcut Ctrl+K triggered!');
  });

  test('quick add: select and remove items', async ({ page }) => {
    const input = page.getByTestId('quick-add');
    const items = page.getByTestId('quick-list').getByRole('listitem');
    const remove = page.getByTestId('quick-remove');
    const status = page.getByTestId('quick-status');

    await expect(status).toHaveText('No items yet.');
    await expect(remove).toBeDisabled();

    for (const name of ['alpha', 'beta', 'gamma', 'delta']) {
      await input.fill(name);
      await input.press('Enter');
    }
    await expect(items).toHaveCount(4);
    await expect(status).toHaveText('4 items, 0 selected');
    await expect(remove).toBeDisabled();

    await page.getByRole('checkbox', { name: 'beta' }).check();
    await page.getByRole('checkbox', { name: 'delta' }).check();
    await expect(status).toHaveText('4 items, 2 selected');
    await expect(remove).toBeEnabled();

    await remove.click();
    await expect(items).toHaveText(['alpha', 'gamma']);
    await expect(status).toHaveText('Removed 2 items. 2 items, 0 selected');
    await expect(remove).toBeDisabled();

    // Unticking before removing leaves the item alone; removing the last one empties the list.
    await page.getByRole('checkbox', { name: 'alpha' }).check();
    await page.getByRole('checkbox', { name: 'alpha' }).uncheck();
    await expect(remove).toBeDisabled();
    await page.getByRole('checkbox', { name: 'alpha' }).check();
    await page.getByRole('checkbox', { name: 'gamma' }).check();
    await remove.click();
    await expect(items).toHaveCount(0);
    await expect(status).toHaveText('Removed 2 items. No items yet.');
  });

  test('quick add: removing one item keeps the singular wording and new items still work', async ({ page }) => {
    const input = page.getByTestId('quick-add');
    await input.fill('only');
    await input.press('Enter');
    await expect(page.getByTestId('quick-status')).toHaveText('1 item, 0 selected');
    await page.getByRole('checkbox', { name: 'only' }).check();
    await page.getByTestId('quick-remove').click();
    await expect(page.getByTestId('quick-status')).toHaveText('Removed 1 item. No items yet.');

    await input.fill('again');
    await input.press('Enter');
    await expect(page.getByTestId('quick-list').getByRole('listitem')).toHaveText(['again']);
  });

  test('quick add: Enter adds, Escape clears', async ({ page }) => {
    const input = page.getByTestId('quick-add');
    await input.fill('first');
    await input.press('Enter');
    await input.pressSequentially('second');
    await input.press('Enter');
    await expect(page.getByTestId('quick-list').getByRole('listitem')).toHaveText(['first', 'second']);
    await expect(input).toHaveValue('');

    await input.fill('discard me');
    await input.press('Escape');
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('quick-list').getByRole('listitem')).toHaveCount(2);
  });
});
