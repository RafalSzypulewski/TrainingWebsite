(function () {
  const { $, esc } = PW;
  const field = (name, value, label = name, extra = {}) => ({ name, value: String(value), label, ...extra });

  // One entry per endpoint: the cards are generated from this list.
  const ENDPOINTS = [
    { id: 'health', method: 'GET', path: '/api/health', summary: 'Is the server up? Always fast.' },
    { id: 'products', method: 'GET', path: '/api/products', summary: 'Paginated product list (size 1-50).', fields: [field('page', 1), field('size', 5), field('q', ''), field('category', '')] },
    { id: 'product', method: 'GET', path: '/api/products/:id', summary: 'One product; 404 for an unknown id.', pathFields: [field('id', 1)] },
    { id: 'slow', method: 'GET', path: '/api/slow', summary: 'Waits ms plus up to jitter ms. Add a seed to make the jitter repeatable.', fields: [field('ms', 300), field('jitter', 0), field('seed', ''), field('i', '')] },
    { id: 'flaky', method: 'GET', path: '/api/flaky', summary: 'Fails a share of requests with 500. rate is between 0 and 1.', fields: [field('rate', 0.2), field('seed', ''), field('i', '')] },
    { id: 'status', method: 'GET', path: '/api/status/:code', summary: 'Answers with the status code you ask for (200-599).', pathFields: [field('code', 418)] },
    { id: 'payload', method: 'GET', path: '/api/payload', summary: 'A response of kb kilobytes, optionally gzip-compressed.', fields: [field('kb', 10), field('gzip', '0', 'gzip', { options: ['0', '1'] })] },
    { id: 'limited', method: 'GET', path: '/api/limited', summary: 'Allows limit requests per window seconds for a key, then answers 429 with Retry-After.', fields: [field('limit', 3), field('window', 10), field('key', 'explorer')] },
    { id: 'queue', method: 'GET', path: '/api/queue', summary: 'A resource with limited capacity: workers requests at once, each taking ms. Others wait in line.', fields: [field('workers', 2), field('ms', 200), field('maxQueue', 500), field('key', 'explorer')] },
    { id: 'me', method: 'GET', path: '/api/me', summary: 'Who is logged in? Needs a token.', auth: true },
    { id: 'cart', method: 'GET', path: '/api/cart', summary: 'The cart with subtotal, shipping and total (in cents). Needs a token.', auth: true },
    { id: 'cart-add', method: 'POST', path: '/api/cart/items', summary: 'Adds a product to the cart. 409 when out of stock. Needs a token.', auth: true, bodyFields: [field('productId', 12), field('qty', 1)] },
    { id: 'checkout', method: 'POST', path: '/api/checkout', summary: 'Turns the cart into an order. Needs a token.', auth: true },
  ];

  const HEADERS_SHOWN = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'content-encoding', 'content-length'];
  const MAX_BODY_CHARS = 1500;
  const byteLength = (text) => new TextEncoder().encode(text).length;

  // ---- building the cards ------------------------------------------------------------------------
  function fieldHtml(id, f, kind) {
    const inputId = `${id}-${kind}-${f.name}`;
    const control = f.options
      ? `<select id="${inputId}" name="${f.name}" data-kind="${kind}">${f.options.map((o) => `<option${o === f.value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input type="text" id="${inputId}" name="${f.name}" value="${esc(f.value)}" data-kind="${kind}" autocomplete="off">`;
    return `<div class="field"><label for="${inputId}">${esc(f.label)}</label>${control}</div>`;
  }

  function cardHtml(e) {
    const fields = [
      ...(e.pathFields ?? []).map((f) => fieldHtml(e.id, f, 'path')),
      ...(e.fields ?? []).map((f) => fieldHtml(e.id, f, 'query')),
      ...(e.bodyFields ?? []).map((f) => fieldHtml(e.id, f, 'body')),
    ].join('');
    return `<section class="card endpoint" data-testid="endpoint-${e.id}" aria-labelledby="h-${e.id}">
      <h3 id="h-${e.id}"><span class="method ${e.method.toLowerCase()}">${e.method}</span> <code>${e.path}</code></h3>
      <p class="help">${esc(e.summary)}</p>
      <form data-endpoint="${e.id}" novalidate>
        ${fields ? `<div class="inline-fields">${fields}</div>` : ''}
        <button type="submit" class="btn small" data-testid="send-${e.id}">Send request</button>
      </form>
      <div class="result" data-testid="result" role="status" aria-live="polite" hidden></div>
    </section>`;
  }

  $('endpoints').innerHTML = ENDPOINTS.map(cardHtml).join('');

  // ---- sending a request -------------------------------------------------------------------------
  function buildRequest(e, form) {
    const value = (kind, name) => form.querySelector(`[data-kind="${kind}"][name="${name}"]`).value.trim();
    let path = e.path;
    for (const f of e.pathFields ?? []) path = path.replace(`:${f.name}`, encodeURIComponent(value('path', f.name)));
    const query = new URLSearchParams();
    for (const f of e.fields ?? []) if (value('query', f.name) !== '') query.set(f.name, value('query', f.name));
    const qs = query.toString();

    const headers = {};
    if (e.auth && PerfApi.getToken()) headers.Authorization = `Bearer ${PerfApi.getToken()}`;
    let body;
    if (e.bodyFields) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(Object.fromEntries(e.bodyFields.map((f) => [f.name, Number(value('body', f.name))])));
    }
    return { method: e.method, url: `${PerfApi.base}${path}${qs ? `?${qs}` : ''}`, headers, body };
  }

  async function send(e, form) {
    const box = form.closest('.endpoint').querySelector('.result');
    const request = buildRequest(e, form);
    box.hidden = false;
    box.innerHTML = '<span class="spinner" aria-hidden="true"></span> Waiting for the answer...';

    const started = performance.now();
    try {
      const res = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, cache: 'no-store' });
      const text = await res.text();
      const elapsed = Math.round(performance.now() - started);

      const shownHeaders = HEADERS_SHOWN.filter((h) => res.headers.has(h)).map((h) => `<li><code>${h}</code>: ${esc(res.headers.get(h))}</li>`).join('');
      const decoded = byteLength(text);
      const wire = res.headers.get('content-length');
      const sizeText = wire && Number(wire) !== decoded ? `${decoded} B decoded, ${wire} B over the wire` : `${decoded} B`;
      const clipped = text.length > MAX_BODY_CHARS;
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON (the payload endpoint) */ }

      box.innerHTML = `
        <p class="result-line">
          <span class="status-badge ${res.ok ? 'ok' : 'error'}" data-testid="result-status">${res.status} ${esc(res.statusText)}</span>
          <span data-testid="result-time">${elapsed} ms</span>
          <span data-testid="result-size">${sizeText}</span>
        </p>
        ${shownHeaders ? `<ul class="header-list" data-testid="result-headers">${shownHeaders}</ul>` : ''}
        <pre class="result-body" data-testid="result-body">${esc(clipped ? `${pretty.slice(0, MAX_BODY_CHARS)}\n... (${decoded} bytes in total, shortened)` : pretty)}</pre>`;
    } catch (err) {
      box.innerHTML = `<p class="banner error" data-testid="result-error" role="alert">Request failed: ${esc(err.message)}. Is the practice API running?</p>`;
    }
  }

  $('endpoints').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    send(ENDPOINTS.find((e) => e.id === form.dataset.endpoint), form);
  });

  // ---- session ---------------------------------------------------------------------------------
  function showSession(message) {
    const loggedIn = Boolean(PerfApi.getToken());
    $('session-status').textContent = message ?? (loggedIn ? 'Logged in. The token is sent with the cart and checkout requests.' : 'Not logged in.');
    $('logout').hidden = !loggedIn;
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    PW.setBusy(true, $('login-submit'));
    try {
      const res = await fetch(`${PerfApi.base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('login-username').value.trim(), password: $('login-password').value }),
      });
      const body = await res.json();
      if (res.ok) {
        PerfApi.setToken(body.token);
        showSession(`Logged in as ${body.user.username} (${body.user.role}).`);
      } else {
        PerfApi.setToken(null);
        showSession(`Login failed: ${body.error} (${res.status}).`);
      }
    } catch (err) {
      showSession(`Login failed: ${err.message}. Is the practice API running?`);
    } finally {
      PW.setBusy(false, $('login-submit'));
    }
  });

  $('logout').addEventListener('click', () => {
    PerfApi.setToken(null);
    showSession();
  });

  // ---- availability ------------------------------------------------------------------------------
  const badge = $('api-status');
  const hint = $('api-hint');

  function setControlsEnabled(enabled) {
    document.querySelectorAll('#endpoints button, #login-form button').forEach((button) => {
      if (button.id !== 'logout') button.disabled = !enabled;
    });
  }

  function describe(online) {
    badge.classList.remove('checking', 'online', 'offline');
    badge.classList.add(online ? 'online' : 'offline');
    setControlsEnabled(online);
    if (online) {
      badge.textContent = `Practice API online (${PerfApi.base})`;
      PW.show(hint, '');
    } else {
      badge.textContent = 'Practice API offline';
      PW.show(hint, `${PerfApi.offlineReason()} The buttons below are disabled until the API answers.`);
    }
  }

  async function check() {
    badge.classList.remove('online', 'offline');
    badge.classList.add('checking');
    badge.textContent = 'Checking...';
    describe(await PerfApi.isOnline());
  }

  $('api-recheck').addEventListener('click', check);
  showSession();
  setControlsEnabled(false); // until the first check succeeds
  check();
})();
