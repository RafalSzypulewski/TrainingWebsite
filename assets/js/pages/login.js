(function () {
  const { $ } = PW;
  const form = $('login-form');
  const spinner = form.querySelector('[data-testid="login-spinner"]');
  const submit = form.querySelector('[type="submit"]');

  // Redirect target: only same-folder .html pages are allowed.
  const requested = PW.param('redirect', '');
  const target = /^[\w-]+\.html$/.test(requested) ? requested : 'dashboard.html';

  if (PW.session.get()) {
    location.replace(target);
    return;
  }

  const reason = PW.param('reason');
  if (reason === 'auth') PW.show($('login-notice'), 'Please log in to view that page.');
  if (reason === 'logout') PW.show($('login-notice'), 'You have been logged out.');

  $('toggle-password').addEventListener('click', (e) => {
    const input = $('password');
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    e.currentTarget.textContent = reveal ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-pressed', String(reveal));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim();
    const password = $('password').value;

    PW.fieldError('username', username ? '' : 'Username is required');
    PW.fieldError('password', password ? '' : 'Password is required');
    PW.show($('login-error'), '');
    if (!username || !password) return;

    PW.setBusy(true, submit, spinner);
    try {
      const users = await PW.fetchJSON('assets/data/login-users.json', { defaultDelay: 500 });
      const user = users.find((u) => u.username === username && u.password === password);
      if (!user) throw new Error('Invalid username or password');
      if (user.locked) throw new Error('This account is locked. Contact support.');
      PW.session.set(user, $('remember').checked);
      location.href = target;
    } catch (err) {
      PW.show($('login-error'), err.message);
      PW.setBusy(false, submit, spinner);
    }
  });
})();
