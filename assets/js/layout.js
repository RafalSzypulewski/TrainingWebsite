/*
 * Shared layout + fake-backend helpers.
 * Include on every page:  <script src="../assets/js/layout.js" defer></script>
 * (use "assets/js/layout.js" on index.html). Site root is derived from this script's URL,
 * so the site works from any sub-path (e.g. https://user.github.io/repo-name/).
 *
 * Query-param toggles (work on every page):
 *   ?delay=2000   simulated latency in ms for fake requests
 *   ?fail=true    fake requests fail with a server error
 */
(function () {
  const root = new URL('../../', document.currentScript.src);
  const params = new URLSearchParams(location.search);
  const SESSION_KEY = 'pw_session';
  const COOKIE = 'pw_session';

  const PW = (window.PW = {
    root: root.href,
    url: (path) => new URL(path, root).href,
    param: (name, fallback = null) => (params.has(name) ? params.get(name) : fallback),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    /** Simulated latency: ?delay=N wins, otherwise the page-specific default. */
    delay(defaultMs = 0) {
      const n = Number(params.get('delay'));
      return params.has('delay') && Number.isFinite(n) && n >= 0 ? n : defaultMs;
    },
    shouldFail: () => params.get('fail') === 'true',

    /** Fake request: waits, optionally fails (unless respectFail is false), otherwise loads static JSON. */
    async fetchJSON(path, { defaultDelay = 0, respectFail = true } = {}) {
      await PW.wait(PW.delay(defaultDelay));
      if (respectFail && PW.shouldFail()) throw new Error('Server error (500)');
      const res = await fetch(PW.url(path));
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },

    session: {
      get() {
        try {
          const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      },
      set(user, remember) {
        const store = remember ? localStorage : sessionStorage;
        store.setItem(SESSION_KEY, JSON.stringify({ username: user.username, role: user.role, storage: remember ? 'localStorage' : 'sessionStorage', loginAt: Date.now() }));
        const maxAge = remember ? '; max-age=604800' : '';
        document.cookie = `${COOKIE}=${encodeURIComponent(user.username)}; path=${root.pathname}; SameSite=Lax${maxAge}`;
      },
      clear() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        document.cookie = `${COOKIE}=; path=${root.pathname}; max-age=0`;
      },
    },

    /** Call on protected pages: redirects to login (remembering where we came from). */
    requireAuth() {
      const s = PW.session.get();
      if (s) return s;
      const page = location.pathname.split('/').pop();
      location.replace(`${PW.url('pages/login.html')}?reason=auth&redirect=${encodeURIComponent(page)}`);
      return null;
    },

    logout() {
      PW.session.clear();
      location.href = `${PW.url('pages/login.html')}?reason=logout`;
    },

    /** Clears every bit of state this site may have stored. */
    resetData() {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (!name) return;
        for (const path of [root.pathname, '/']) document.cookie = `${name}=; path=${path}; max-age=0`;
      });
      location.reload();
    },
  });

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
  ];

  function render() {
    const current = location.pathname.replace(/\/$/, '/index.html');
    const isCurrent = (path) => current.endsWith('/' + path);
    const link = ([path, label]) => `<li><a href="${PW.url(path)}"${isCurrent(path) ? ' aria-current="page"' : ''}>${label}</a></li>`;
    const links = NAV.map((entry) => {
      if (typeof entry[1] === 'string') return link(entry);
      const [label, items] = entry;
      const active = items.some(([path]) => isCurrent(path)) ? ' data-active="true"' : '';
      return `<li class="nav-group"><button type="button" class="nav-toggle" aria-expanded="false" aria-haspopup="true"${active}>${label}</button><ul class="nav-menu">${items.map(link).join('')}</ul></li>`;
    }).join('');
    const s = PW.session.get();
    const auth = s ? `<span class="nav-auth" data-testid="nav-user">Signed in as ${s.username}</span>` : '';

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="container bar">
        <a class="brand" href="${PW.url('index.html')}" data-testid="brand">PW Practice Lab</a>
        <nav aria-label="Main"><ul>${links}</ul></nav>
        ${auth}
      </div>`;
    document.body.prepend(header);

    const toggles = ['delay', 'fail'].filter((k) => params.has(k)).map((k) => `${k}=${params.get(k)}`);
    if (toggles.length) {
      const bar = document.createElement('div');
      bar.className = 'toggle-bar';
      bar.dataset.testid = 'active-toggles';
      bar.innerHTML = `<div class="container">Active toggles: <strong>${toggles.join(', ')}</strong></div>`;
      header.after(bar);
    }

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <p>Practice site for test automation. All data is fake and stored in your browser only.<br>
          <span class="version" data-testid="site-version" hidden></span></p>
        <button type="button" class="btn secondary small" data-testid="reset-data">Reset data</button>
      </div>`;
    document.body.append(footer);
    footer.querySelector('button').addEventListener('click', PW.resetData);

    // Version comes from assets/data/version.json; the deploy workflow adds the commit and build date.
    fetch(PW.url('assets/data/version.json'), { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((info) => {
        const el = footer.querySelector('[data-testid="site-version"]');
        el.textContent = ['v' + info.version, info.commit, info.built && 'built ' + info.built].filter(Boolean).join(' \u00b7 ');
        el.hidden = false;
      })
      .catch(() => {}); // version info is optional

    // Dropdown groups: click toggles, Escape / outside click closes (hover and focus also open via CSS).
    const groups = [...header.querySelectorAll('.nav-group')];
    const closeAll = (except) => groups.forEach((g) => {
      if (g !== except) { g.classList.remove('open'); g.querySelector('.nav-toggle').setAttribute('aria-expanded', 'false'); }
    });
    groups.forEach((g) => g.querySelector('.nav-toggle').addEventListener('click', (e) => {
      closeAll(g);
      const open = g.classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', String(open));
    }));
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav-group')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main';
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
