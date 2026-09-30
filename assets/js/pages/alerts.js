(function () {
  const $ = (id) => document.getElementById(id);
  const result = (msg) => { $('dialog-result').textContent = msg; };

  // 1. Native dialogs --------------------------------------------------------
  $('alert-btn').addEventListener('click', () => {
    alert('Hello from an alert!');
    result('Alert closed');
  });
  $('confirm-btn').addEventListener('click', () => {
    result(confirm('Do you want to continue?') ? 'You clicked OK' : 'You clicked Cancel');
  });
  $('prompt-btn').addEventListener('click', () => {
    const name = prompt('What is your name?', 'Guest');
    result(name === null ? 'Prompt cancelled' : `Hello, ${name}!`);
  });

  // 2. Modal -----------------------------------------------------------------
  const modal = $('modal');
  $('modal-btn').addEventListener('click', () => {
    $('modal-email').value = '';
    modal.showModal();
  });
  modal.addEventListener('close', () => {
    if (modal.returnValue === 'confirm') result(`Modal confirmed with email: ${$('modal-email').value || '(empty)'}`);
    else if (modal.returnValue === 'cancel') result('Modal cancelled');
    else result('Modal dismissed');
    modal.returnValue = '';
  });

  // 3. Toasts ----------------------------------------------------------------
  function toast(kind, text) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.dataset.testid = 'toast';
    el.innerHTML = '<span></span><button type="button" aria-label="Dismiss notification">&times;</button>';
    el.firstChild.textContent = text;
    el.querySelector('button').addEventListener('click', () => el.remove());
    $('toast-region').append(el);
    setTimeout(() => el.remove(), PW.delay(3000));
  }
  $('toast-success').addEventListener('click', () => toast('success', 'Saved successfully'));
  $('toast-error').addEventListener('click', () => toast('error', 'Something went wrong'));

  // 4. Cookie banner ---------------------------------------------------------
  const COOKIE = 'pw_cookie_consent';
  const readConsent = () => document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))?.split('=')[1] ?? null;
  function showConsent() {
    const value = readConsent();
    $('consent-status').textContent = value ?? 'not chosen';
    $('cookie-banner').hidden = value !== null;
  }
  function choose(value) {
    document.cookie = `${COOKIE}=${value}; path=${new URL(PW.root).pathname}; max-age=31536000; SameSite=Lax`;
    showConsent();
  }
  $('cookie-accept').addEventListener('click', () => choose('accepted'));
  $('cookie-reject').addEventListener('click', () => choose('rejected'));
  showConsent();
})();
