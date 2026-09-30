(function () {
  const $ = (id) => document.getElementById(id);
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ---- GOOD ----------------------------------------------------------------
  $('good-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('good-email');
    const value = input.value.trim();
    const error = !value ? 'Email is required' : !validEmail(value) ? 'Enter a valid email address' : '';
    $('good-email-error').textContent = error;
    input.setAttribute('aria-invalid', String(!!error));
    $('good-status').textContent = error ? '' : `Subscribed ${value}`;
    if (error) input.focus();
  });

  $('good-acc-btn').addEventListener('click', (e) => {
    const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
    e.currentTarget.setAttribute('aria-expanded', String(!open));
    $('good-acc-panel').hidden = open;
  });

  const tabs = [...document.querySelectorAll('#good-tabs [role="tab"]')];
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  // ---- BAD (mouse only, no semantics) -------------------------------------
  $('bad-submit').addEventListener('click', () => {
    const value = $('bad-email').value.trim();
    $('bad-email-error').textContent = validEmail(value) ? '' : ' invalid!';
    $('bad-status').textContent = validEmail(value) ? `Subscribed ${value}` : '';
  });
  $('bad-acc-btn').addEventListener('click', () => {
    const panel = $('bad-acc-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.querySelectorAll('.fake-tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.fake-tab').forEach((t) => {
      t.classList.toggle('selected', t === tab);
      $(t.dataset.panel).style.display = t === tab ? 'block' : 'none';
    });
  }));
})();
