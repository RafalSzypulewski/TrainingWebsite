/*
 * Page shell: header with grouped navigation, the "active toggles" bar, and a footer with the
 * test-toggle panel, the site version and the Reset data button.
 * Needs core/pw.js to be loaded first (see the script tags in any page).
 */
(function () {
  const TOGGLES = ['delay', 'fail'];

  // Top-level entries are either a link [path, label] or a dropdown group [label, [links]].
  const NAV = [
    ['index.html', 'Home'],
    ['Core', [
      ['pages/login.html', 'Login'],
      ['pages/dashboard.html', 'Dashboard'],
      ['pages/forms.html', 'Forms'],
      ['pages/dynamic.html', 'Dynamic content'],
      ['pages/tables.html', 'Tables'],
    ]],
    ['Intermediate', [
      ['pages/alerts.html', 'Alerts &amp; dialogs'],
      ['pages/windows.html', 'Windows &amp; frames'],
      ['pages/mouse.html', 'Mouse &amp; keyboard'],
      ['pages/downloads.html', 'Downloads'],
    ]],
    ['pages/shop.html', 'Shop'],
    ['Advanced', [
      ['pages/network.html', 'Network'],
      ['pages/accessibility.html', 'Accessibility'],
      ['pages/responsive.html', 'Responsive'],
      ['pages/tricky.html', 'Tricky'],
    ]],
    ['Performance', [
      ['pages/performance.html', 'Performance lab'],
      ['pages/performance-api.html', 'API explorer'],
    ]],
  ];

  /** "delay=500", "fail=true", ... for the toggles present in the URL. */
  const activeToggles = () => TOGGLES.filter((name) => PW.param(name) !== null).map((name) => `${name}=${PW.param(name)}`);

  function navHtml() {
    const current = location.pathname.replace(/\/$/, '/index.html');
    const isCurrent = (path) => current.endsWith('/' + path);
    const link = ([path, label]) => `<li><a href="${PW.url(path)}"${isCurrent(path) ? ' aria-current="page"' : ''}>${label}</a></li>`;
    return NAV.map((entry) => {
      if (typeof entry[1] === 'string') return link(entry);
      const [label, items] = entry;
      const active = items.some(([path]) => isCurrent(path)) ? ' data-active="true"' : '';
      return `<li class="nav-group"><button type="button" class="nav-toggle" aria-expanded="false" aria-haspopup="true"${active}>${label}</button><ul class="nav-menu">${items.map(link).join('')}</ul></li>`;
    }).join('');
  }

  function buildHeader() {
    const session = PW.session.get();
    const auth = session ? `<span class="nav-auth" data-testid="nav-user">Signed in as ${PW.esc(session.username)}</span>` : '';
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="container bar">
        <a class="brand" href="${PW.url('index.html')}" data-testid="brand">PW Practice Lab</a>
        <nav aria-label="Main"><ul>${navHtml()}</ul></nav>
        ${auth}
      </div>`;
    document.body.prepend(header);
    return header;
  }

  /** Dropdown groups: click toggles, Escape / outside click closes (hover also opens them via CSS). */
  function wireNavGroups(header) {
    const groups = [...header.querySelectorAll('.nav-group')];
    const closeAll = (except) => groups.forEach((g) => {
      if (g !== except) {
        g.classList.remove('open');
        g.querySelector('.nav-toggle').setAttribute('aria-expanded', 'false');
      }
    });
    groups.forEach((g) => g.querySelector('.nav-toggle').addEventListener('click', (e) => {
      closeAll(g);
      const open = g.classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', String(open));
    }));
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav-group')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  }

  function buildToggleBar(header, active) {
    if (!active.length) return;
    const bar = document.createElement('div');
    bar.className = 'toggle-bar';
    bar.dataset.testid = 'active-toggles';
    bar.innerHTML = `<div class="container">Active toggles: <strong>${active.join(', ')}</strong></div>`;
    header.after(bar);
  }

  function buildFooter(active) {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <p>Practice site for test automation. All data is fake and stored in your browser only.<br>
          <span class="version" data-testid="site-version" hidden></span></p>
        <div class="footer-actions">
          <details class="toggle-panel" data-testid="toggle-panel"${active.length ? ' open' : ''}>
            <summary>Test toggles</summary>
            <form class="toggle-form" novalidate>
              <label>Delay (ms) <input type="number" min="0" step="100" inputmode="numeric" data-testid="toggle-delay"></label>
              <label><input type="checkbox" data-testid="toggle-fail"> Fail requests</label>
              <button type="submit" class="btn small" data-testid="toggle-apply">Apply toggles</button>
              <button type="button" class="btn secondary small" data-testid="toggle-clear">Clear toggles</button>
              <span class="toggle-error" role="alert" data-testid="toggle-error" hidden></span>
            </form>
          </details>
          <button type="button" class="btn secondary small" data-testid="reset-data">Reset data</button>
        </div>
      </div>`;
    document.body.append(footer);
    footer.querySelector('[data-testid="reset-data"]').addEventListener('click', PW.resetData);
    return footer;
  }

  /** Toggle panel: edits ?delay and ?fail in the URL (other query parameters are kept) and reloads. */
  function wireToggleForm(footer) {
    const form = footer.querySelector('.toggle-form');
    const delayInput = form.querySelector('[data-testid="toggle-delay"]');
    const failInput = form.querySelector('[data-testid="toggle-fail"]');
    const error = form.querySelector('[data-testid="toggle-error"]');
    delayInput.value = PW.param('delay', '');
    failInput.checked = PW.param('fail') === 'true';

    const navigateWith = (change) => {
      const url = new URL(location.href);
      change(url.searchParams);
      location.href = url.href;
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = delayInput.value.trim();
      const delay = Number(raw);
      if (raw !== '' && !(Number.isInteger(delay) && delay >= 0)) {
        PW.show(error, 'Delay must be a whole number of milliseconds (0 or more).');
        delayInput.setAttribute('aria-invalid', 'true');
        return;
      }
      navigateWith((q) => {
        if (raw === '') q.delete('delay'); else q.set('delay', String(delay));
        if (failInput.checked) q.set('fail', 'true'); else q.delete('fail');
      });
    });
    form.querySelector('[data-testid="toggle-clear"]').addEventListener('click', () => {
      navigateWith((q) => TOGGLES.forEach((name) => q.delete(name)));
    });
  }

  /** The version comes from assets/data/version.json; the deploy workflow adds the commit and build date. */
  function showVersion(footer) {
    fetch(PW.url('assets/data/version.json'), { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('no version info'))))
      .then((info) => {
        const el = footer.querySelector('[data-testid="site-version"]');
        PW.show(el, ['v' + info.version, info.commit, info.built && 'built ' + info.built].filter(Boolean).join(' · '));
      })
      .catch(() => {}); // version info is optional
  }

  function render() {
    const active = activeToggles();
    const header = buildHeader();
    wireNavGroups(header);
    buildToggleBar(header, active);
    const footer = buildFooter(active);
    wireToggleForm(footer);
    showVersion(footer);

    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main';
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
