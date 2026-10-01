import { test, expect } from '../support/fixtures';

/** Direct tests of the shared PW library (assets/js/core/pw.js), run in the browser through page.evaluate. */
test.describe('PW helpers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
  });

  test('esc escapes HTML special characters', async ({ page }) => {
    const escaped = await page.evaluate(() => PW.esc(`<img src=x onerror="alert('x')"> & more`));
    expect(escaped).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; more');
  });

  test('isEmail', async ({ page }) => {
    const results = await page.evaluate(() => ['ada@example.com', 'a@b.co', 'nope', 'a@b', 'a b@c.de', '@x.io'].map((v) => PW.isEmail(v)));
    expect(results).toEqual([true, true, false, false, false, false]);
  });

  test('show fills and reveals an element, an empty message hides it', async ({ page }) => {
    const states = await page.evaluate(() => {
      const el = document.createElement('p');
      el.hidden = true;
      PW.show(el, 'Hello');
      const shown = [el.textContent, el.hidden];
      PW.show(el, '');
      return [...shown, el.textContent, el.hidden];
    });
    expect(states).toEqual(['Hello', false, '', true]);
  });

  test('fieldError writes the message and sets aria-invalid on the control', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<input id="zz"><p id="zz-error" hidden></p><fieldset id="grp"></fieldset><p id="grp-error" hidden></p>');
      const returned = PW.fieldError('zz', 'Required');
      const bad = [document.getElementById('zz-error')!.textContent, document.getElementById('zz-error')!.hidden, document.getElementById('zz')!.getAttribute('aria-invalid')];
      PW.fieldError('zz', '');
      const good = [document.getElementById('zz-error')!.hidden, document.getElementById('zz')!.getAttribute('aria-invalid')];
      PW.fieldError('grp', 'Pick one'); // not a form control: message only, no aria-invalid
      return { returned, bad, good, group: [document.getElementById('grp-error')!.hidden, document.getElementById('grp')!.hasAttribute('aria-invalid')] };
    });
    expect(result).toEqual({ returned: 'Required', bad: ['Required', false, 'true'], good: [true, 'false'], group: [false, false] });
  });

  test('errorSummary pluralises and hides at zero', async ({ page }) => {
    const texts = await page.evaluate(() => {
      const el = document.createElement('p');
      const out: (string | boolean)[] = [];
      for (const n of [1, 3, 0]) {
        PW.errorSummary(el, n, 'saving');
        out.push(el.textContent!, el.hidden);
      }
      return out;
    });
    expect(texts).toEqual(['Please fix 1 error before saving.', false, 'Please fix 3 errors before saving.', false, '', true]);
  });

  test('setBusy toggles the button and the spinner', async ({ page }) => {
    const states = await page.evaluate(() => {
      const button = document.createElement('button');
      const spinner = document.createElement('span');
      PW.setBusy(true, button, spinner);
      const busy = [button.disabled, spinner.hidden];
      PW.setBusy(false, button, spinner);
      return [...busy, button.disabled, spinner.hidden];
    });
    expect(states).toEqual([true, false, false, true]);
  });

  test('storage.getJSON falls back for missing or corrupt values', async ({ page }) => {
    const values = await page.evaluate(() => {
      localStorage.setItem('good', '{"a":1}');
      localStorage.setItem('bad', '{oops');
      PW.storage.setJSON('round', { list: [1, 2] });
      return [PW.storage.getJSON('good', null), PW.storage.getJSON('bad', 'fallback'), PW.storage.getJSON('missing', []), PW.storage.getJSON('round', null)];
    });
    expect(values).toEqual([{ a: 1 }, 'fallback', [], { list: [1, 2] }]);
  });

  test('cookie set / get / names / remove, with encoding', async ({ page, context }) => {
    const before = await page.evaluate(() => {
      PW.cookie.set('demo', 'a b;c');
      PW.cookie.set('other', 'x', { maxAge: 60 });
      return [PW.cookie.get('demo'), PW.cookie.get('nope'), PW.cookie.names().sort()];
    });
    expect(before).toEqual(['a b;c', null, ['demo', 'other']]);
    expect((await context.cookies()).find((c) => c.name === 'other')?.expires).toBeGreaterThan(Date.now() / 1000);

    const after = await page.evaluate(() => {
      PW.cookie.remove('demo');
      return PW.cookie.names();
    });
    expect(after).toEqual(['other']);
  });

  test('toast: auto-dismisses, and only dismissible toasts get a close button', async ({ page }) => {
    await page.goto('index.html?delay=400');
    await page.evaluate(() => {
      PW.toast('Plain toast');
      PW.toast('Closable toast', { kind: 'error', dismissible: true });
    });
    const plain = page.getByTestId('toast').filter({ hasText: 'Plain toast' });
    const closable = page.getByTestId('toast').filter({ hasText: 'Closable toast' });

    await expect(plain).toHaveText('Plain toast'); // no close button text appended
    await expect(plain.getByRole('button')).toHaveCount(0);
    await expect(closable).toHaveClass(/error/);
    await closable.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(closable).toHaveCount(0);
    await expect(plain).toHaveCount(0); // removed by its timer
    await expect(page.getByRole('status').and(page.locator('#toast-region'))).toHaveCount(1); // one shared live region
  });

  test('session round trip and Reset data clears cookies and storage', async ({ page, context }) => {
    await page.evaluate(() => {
      PW.session.set({ username: 'student', role: 'user' }, true);
      PW.cookie.set('pw_cookie_consent', 'accepted');
      PW.storage.setJSON('pw_cart', [{ id: 1, qty: 1 }]);
    });
    expect(await page.evaluate(() => PW.session.get()?.username)).toBe('student');
    expect((await context.cookies()).map((c) => c.name).sort()).toEqual(['pw_cookie_consent', 'pw_session']);

    await page.getByTestId('reset-data').click();
    await expect.poll(async () => (await context.cookies()).length).toBe(0);
    expect(await page.evaluate(() => [PW.session.get(), localStorage.length])).toEqual([null, 0]);
  });
});
