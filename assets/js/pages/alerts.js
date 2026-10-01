(function () {
  const { $ } = PW;
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
  $('toast-success').addEventListener('click', () => PW.toast('Saved successfully', { dismissible: true }));
  $('toast-error').addEventListener('click', () => PW.toast('Something went wrong', { kind: 'error', dismissible: true }));

  // 4. Cookie banner ---------------------------------------------------------
  const COOKIE = 'pw_cookie_consent';
  function showConsent() {
    const value = PW.cookie.get(COOKIE);
    $('consent-status').textContent = value ?? 'not chosen';
    $('cookie-banner').hidden = value !== null;
  }
  function choose(value) {
    PW.cookie.set(COOKIE, value, { maxAge: 31536000 });
    showConsent();
  }
  $('cookie-accept').addEventListener('click', () => choose('accepted'));
  $('cookie-reject').addEventListener('click', () => choose('rejected'));
  showConsent();
})();
