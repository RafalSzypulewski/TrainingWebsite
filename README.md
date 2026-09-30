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
| `pages/dynamic.html` | done | Loading spinners, delayed/disappearing elements, delayed enable, progress bar, infinite scroll |
| `pages/tables.html` | done | Sort, search, filters, pagination, inline edit, delete with confirmation, bulk delete, persisted changes |
| `pages/alerts.html` | done | Native alert/confirm/prompt handlers, `<dialog>` modal, auto-dismissing toasts, cookie banner overlay (cookie assertions) |
| `pages/windows.html` | done | New tab/popup, iframe, nested iframes, `srcdoc` frame, open shadow DOM |
| `pages/mouse.html` | done | Hover, click/dblclick/right-click/modifier click, custom context menu, drag and drop, custom slider, keyboard events and shortcuts |
| `pages/downloads.html` | done | Blob/CSV download, custom text file, JSON export, static download, CSV import |
| `pages/shop.html` → `product.html` → `cart.html` → `checkout.html` → `confirmation.html` | done | Product list (search, category, price, stock, sort), product detail, cart (quantities, stock limits, promo codes `SAVE10` / `FREESHIP`, shipping rules), checkout validation, declined card (`4000 0000 0000 0002`), order confirmation, full purchase flow |
| `pages/network.html` | done | Real fetches to mock with `page.route`: success/empty/500/abort, delays and timeouts, retries, polling, POST body and request-header assertions |
| `pages/accessibility.html` | done | Good vs bad markup side by side, role/label locators, axe scans, keyboard-operable accordion and tabs, aria snapshots |
| `pages/responsive.html` | done | Breakpoints, collapsing menu, responsive grid and table, `<picture>`, viewport/touch/colour-scheme/reduced-motion emulation |
| `pages/tricky.html` | done | Duplicate ids, changing classes/ids, delayed-enable, self-disabling, covered and moving buttons, re-rendering list, hidden variants, duplicate text, disabled/readonly/contenteditable |

Demo accounts: `student / Password123!`, `admin / Admin123!`, `locked / Locked123!` (locked).

Each page has an **Exercises** panel with tasks to automate. Most elements have `data-testid`;
some (e.g. the "Forgot password" link, the Show/Hide button, the Website field) deliberately don't,
so role/label/text/CSS locators can be practiced.
