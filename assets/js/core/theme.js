/*
 * Color theme: "dark" (default) or "light", remembered in localStorage.
 * Loaded synchronously in <head> so the theme is applied before the first paint (no flash).
 * The header switch is built in layout.js and calls PWTheme.toggle().
 */
(function () {
  const KEY = 'pw.theme';
  const read = () => {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  };
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  };
  apply(read());

  window.PWTheme = {
    KEY,
    get: () => document.documentElement.dataset.theme,
    set(theme) {
      apply(theme);
      try { localStorage.setItem(KEY, theme); } catch { /* storage blocked: theme lasts for this page only */ }
      document.dispatchEvent(new CustomEvent('pw:theme', { detail: theme }));
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  };
  // Keep other tabs and frames in sync.
  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(read()); });
})();
