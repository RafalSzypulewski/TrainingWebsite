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

  // Required-field rules; each returns an error message, or '' when the field is fine.
  const rules = {
    username: (value) => (value.trim() ? '' : 'Username is required'),
    password: (value) => (value ? '' : 'Password is required'),
  };
  const validate = (name) => PW.fieldError(name, rules[name]($(name).value));

  for (const name of Object.keys(rules)) {
    // Leaving a required field empty shows its message straight away (not only on submit).
    $(name).addEventListener('blur', () => validate(name));
    // While a message is showing, re-check as the user types so it disappears as soon as the field is fixed.
    $(name).addEventListener('input', () => {
      if (!$(`${name}-error`).hidden) validate(name);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = Object.keys(rules).map(validate).filter(Boolean);
    PW.show($('login-error'), '');
    if (errors.length) return;

    const username = $('username').value.trim();
    const password = $('password').value;

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
