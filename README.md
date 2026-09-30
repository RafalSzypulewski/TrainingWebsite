# PW Practice Lab

A static, backend-free website for practicing test automation with Playwright.
Plain HTML/CSS/vanilla JS, no build step. State lives in `localStorage`, `sessionStorage`
and cookies; "server" data is static JSON in `assets/data/` loaded via `fetch()`.

## Run locally

```bash
npm install
npx playwright install chromium
npm start        # http://localhost:4173
npm test         # starts the server itself and runs all specs
```

## Deploy (GitHub Pages)

1. Push to `main` on GitHub.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. `.github/workflows/pages.yml` publishes `index.html`, `pages/` and `assets/`.

All links are relative, so the site works under `/repo-name/`.

## Testing the deployed site

```bash
BASE_URL=https://<user>.github.io/<repo>/ npm test        # bash
$env:BASE_URL="https://<user>.github.io/<repo>/"; npm test   # PowerShell
```

Or run the **Playwright tests** workflow manually and pass `base_url`.
Tests use relative URLs (`page.goto('pages/login.html')`), so `baseURL` must end in `/`
(the config adds it if missing).

## Toggles and reset

| Param | Effect |
| --- | --- |
| `?delay=2000` | Simulated latency (ms) for fake requests |
| `?fail=true` | Fake requests fail with a server error |

The footer **Reset data** button clears local/session storage and cookies, then reloads.

## Pages

| Page | Status | Exercises |
| --- | --- | --- |
| `index.html` | done | Locate cards, follow links |
| `pages/login.html` | done | Valid/invalid login, empty validation, locked user, remember me (storage), spinner via `?delay`, error via `?fail`, protected-page redirect |
| `pages/dashboard.html` | done | Protected page, role-based panel, logout |
| `pages/forms.html` | done | All input types, validation messages, range/counter, single + multiple file upload, native HTML5 validation |
| Dynamic content, Tables | planned (step 2) | |
| Alerts, Windows & frames, Mouse & keyboard, Downloads | planned (step 3) | |
| Mini shop | planned (step 4) | |
| Network, Accessibility, Responsive, Tricky | planned (step 5) | |

Demo accounts: `student / Password123!`, `admin / Admin123!`, `locked / Locked123!` (locked).

Each page has an **Exercises** panel with tasks to automate. Most elements have `data-testid`;
some (e.g. the "Forgot password" link, the Show/Hide button, the Website field) deliberately don't,
so role/label/text/CSS locators can be practiced.
