/*
 * PW: the runtime library every page shares (fake backend helpers, storage, session, small DOM helpers).
 * Load it first, then core/layout.js, then the page's own script, all with `defer`:
 *
 *   <script src="../assets/js/core/pw.js" defer></script>      (index.html: "assets/js/core/pw.js")
 *
 * The site root is derived from this script's URL, so the site works from any sub-path
 * (for example https://user.github.io/repo-name/).
 *
 * Query-param toggles (work on every page):
 *   ?delay=2000   simulated latency in ms for fake requests
 *   ?fail=true    fake requests fail with a server error
 */
(function () {
  const root = new URL('../../../', document.currentScript.src);
  const params = new URLSearchParams(location.search);
  const SESSION_KEY = 'pw_session';
  const FORM_CONTROL = /^(INPUT|SELECT|TEXTAREA)$/;

  const PW = (window.PW = {
    // ---- URLs, query parameters and the fake network ----------------------------------------
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

    // ---- small DOM and formatting helpers ---------------------------------------------------
    $: (id) => document.getElementById(id),

    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

    isEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),

    /** Puts a message into an element and shows it; an empty message hides the element. */
    show(el, message) {
      el.textContent = message;
      el.hidden = !message;
    },

    /**
     * Form validation feedback by id: the message goes into `#<id>-error`, and the control `#<id>`
     * (when it is an input, select or textarea) gets aria-invalid. Returns the message.
     */
    fieldError(id, message) {
      const error = document.getElementById(`${id}-error`);
      if (error) PW.show(error, message);
      const control = document.getElementById(id);
      if (control && FORM_CONTROL.test(control.tagName)) control.setAttribute('aria-invalid', String(!!message));
      return message;
    },

    /** "Please fix 3 errors before submitting." banner; hidden when there are no errors. */
    errorSummary(el, count, action) {
      PW.show(el, count ? `Please fix ${count} error${count === 1 ? '' : 's'} before ${action}.` : '');
    },

    /** Disables a button and shows a spinner while something is in progress. */
    setBusy(busy, button, spinner) {
      if (button) button.disabled = busy;
      if (spinner) spinner.hidden = !busy;
    },

    /**
     * Toast notification in a live region that is created on first use. It removes itself after
     * `duration` ms (?delay overrides), or earlier through the close button when `dismissible`.
     */
    toast(message, { kind = 'success', dismissible = false, duration = 3000 } = {}) {
      let region = document.getElementById('toast-region');
      if (!region) {
        region = Object.assign(document.createElement('div'), { id: 'toast-region', className: 'toast-region' });
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.append(region);
      }
      const el = Object.assign(document.createElement('div'), { className: `toast ${kind}` });
      el.dataset.testid = 'toast';
      el.append(Object.assign(document.createElement('span'), { textContent: message }));
      if (dismissible) {
        const close = Object.assign(document.createElement('button'), { type: 'button', innerHTML: '&times;' });
        close.setAttribute('aria-label', 'Dismiss notification');
        close.addEventListener('click', () => el.remove());
        el.append(close);
      }
      region.append(el);
      setTimeout(() => el.remove(), PW.delay(duration));
    },

    // ---- browser storage and cookies --------------------------------------------------------
    storage: {
      /** JSON from localStorage; `fallback` when the key is missing or the value is not valid JSON. */
      getJSON(key, fallback) {
        try {
          const raw = localStorage.getItem(key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch {
          return fallback;
        }
      },
      setJSON: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    },

    /** Cookies scoped to the site's base path, so they work under /repo-name/ as well. */
    cookie: {
      names: () => document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean),
      get(name) {
        const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
        return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
      },
      set(name, value, { maxAge } = {}) {
        document.cookie = `${name}=${encodeURIComponent(value)}; path=${root.pathname}; SameSite=Lax${maxAge ? `; max-age=${maxAge}` : ''}`;
      },
      remove(name) {
        for (const path of [root.pathname, '/']) document.cookie = `${name}=; path=${path}; max-age=0`;
      },
    },

    // ---- fake authentication ----------------------------------------------------------------
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
        PW.cookie.set(SESSION_KEY, user.username, { maxAge: remember ? 604800 : undefined });
      },
      clear() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        PW.cookie.remove(SESSION_KEY);
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

    /** Clears every bit of state this site may have stored, then reloads. */
    resetData() {
      localStorage.clear();
      sessionStorage.clear();
      PW.cookie.names().forEach((name) => PW.cookie.remove(name));
      location.reload();
    },
  });
})();
