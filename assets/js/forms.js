(function () {
  const form = document.getElementById('signup-form');
  const $ = (id) => document.getElementById(id);
  const today = new Date().toISOString().slice(0, 10);
  const ext = (f) => f.name.split('.').pop().toLowerCase();

  // Each rule returns an error message, or '' when valid.
  const rules = {
    fullName: (v) => (!v.trim() ? 'Full name is required' : v.trim().length < 2 ? 'Full name must be at least 2 characters' : ''),
    email: (v) => (!v ? 'Email is required' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email address' : ''),
    password: (v) => (!v ? 'Password is required' : v.length < 8 || !/\d/.test(v) ? 'Password must be at least 8 characters and include a number' : ''),
    confirmPassword: (v) => (v !== read('password') ? 'Passwords do not match' : ''),
    age: (v) => (v === '' ? 'Age is required' : +v < 18 || +v > 99 ? 'Age must be between 18 and 99' : ''),
    phone: (v) => (v && !/^\+?[0-9 -]{7,15}$/.test(v) ? 'Enter a valid phone number' : ''),
    website: (v) => (v && !/^https?:\/\/.+\..+/.test(v) ? 'Website must start with http:// or https://' : ''),
    birthdate: (v) => (!v ? 'Birth date is required' : v > today ? 'Birth date cannot be in the future' : ''),
    country: (v) => (!v ? 'Please select a country' : ''),
    gender: (v) => (!v ? 'Please choose an account type' : ''),
    bio: (v) => (v.length > 200 ? 'Bio must be at most 200 characters' : ''),
    terms: (v) => (!v ? 'You must accept the terms' : ''),
    avatar: (files) => {
      const f = files[0];
      if (!f) return '';
      if (!['image/png', 'image/jpeg'].includes(f.type)) return 'Avatar must be a PNG or JPG image';
      return f.size > 1024 * 1024 ? 'Avatar must be smaller than 1 MB' : '';
    },
    documents: (files) => {
      if (files.length > 3) return 'You can upload at most 3 documents';
      return files.some((f) => !['pdf', 'txt'].includes(ext(f))) ? 'Only PDF and TXT documents are allowed' : '';
    },
  };

  function read(name) {
    const el = form.elements[name];
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'file') return [...el.files];
    return el.value; // text-like inputs, selects, and RadioNodeList
  }

  function validateField(name) {
    const msg = rules[name](read(name));
    const err = $(`${name}-error`);
    err.textContent = msg;
    err.hidden = !msg;
    const input = $(name);
    if (input && /^(INPUT|SELECT|TEXTAREA)$/.test(input.tagName)) input.setAttribute('aria-invalid', String(!!msg));
    return msg;
  }

  function clearAll() {
    Object.keys(rules).forEach((name) => {
      $(`${name}-error`).hidden = true;
      $(name)?.removeAttribute('aria-invalid');
    });
    $('form-summary').hidden = true;
    $('form-server-error').hidden = true;
    $('result').hidden = true;
  }

  // Re-validate a field as it changes, but only once it has been flagged.
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (rules[name] && !$(`${name}-error`).hidden) validateField(name);
    if (name === 'password' && !$('confirmPassword-error').hidden) validateField('confirmPassword');
  });
  form.addEventListener('change', (e) => {
    const name = e.target.name;
    if (rules[name] && (e.target.type === 'file' || !$(`${name}-error`).hidden)) validateField(name);
  });

  $('satisfaction').addEventListener('input', (e) => { $('satisfaction-output').textContent = e.target.value; });
  $('bio').addEventListener('input', (e) => { $('bio-count').textContent = `${e.target.value.length}/200`; });
  $('documents').addEventListener('change', (e) => {
    const list = $('documents-list');
    list.replaceChildren(...[...e.target.files].map((f) => Object.assign(document.createElement('li'), { textContent: f.name })));
  });
  form.addEventListener('reset', () => {
    clearAll();
    $('satisfaction-output').textContent = '5';
    $('bio-count').textContent = '0/200';
    $('documents-list').replaceChildren();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('form-server-error').hidden = true;
    $('result').hidden = true;

    const errors = Object.keys(rules).map(validateField).filter(Boolean);
    const summary = $('form-summary');
    summary.hidden = errors.length === 0;
    summary.textContent = `Please fix ${errors.length} error${errors.length === 1 ? '' : 's'} before submitting.`;
    if (errors.length) return;

    const submit = form.querySelector('[type="submit"]');
    const spinner = form.querySelector('[data-testid="form-spinner"]');
    submit.disabled = true;
    spinner.hidden = false;
    try {
      await PW.wait(PW.delay(300));
      if (PW.shouldFail()) throw new Error('Server error (500): could not save your registration.');

      const fd = new FormData(form);
      const data = {};
      for (const key of new Set(fd.keys())) {
        const all = fd.getAll(key).map((v) => (v instanceof File ? v.name : v)).filter((v) => v !== '');
        data[key] = ['skills', 'interests', 'documents'].includes(key) ? all : (all[0] ?? '');
      }
      data.password = '********';
      delete data.confirmPassword;
      data.terms = true;
      localStorage.setItem('pw_forms_last', JSON.stringify(data));

      $('result-json').textContent = JSON.stringify(data, null, 2);
      $('result').hidden = false;
    } catch (err) {
      const box = $('form-server-error');
      box.textContent = err.message;
      box.hidden = false;
    } finally {
      submit.disabled = false;
      spinner.hidden = true;
    }
  });

  // Newsletter form uses native constraint validation; 'submit' only fires when valid.
  $('newsletter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('newsletter-status').textContent = `Subscribed ${e.target.elements.email.value} with code ${e.target.elements.code.value}`;
  });
})();
