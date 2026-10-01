'use strict';
/*
 * Practice API for performance testing with k6. Development only: it is NOT part of the published
 * (static) site. It serves the site's files plus a small /api whose behaviour you control with
 * query parameters, so latency, errors and payload sizes are reproducible.
 *
 *   node perf/server/server.js          (PERF_PORT=4180 by default, bound to 127.0.0.1 only)
 *
 * No dependencies: Node built-ins only.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PERF_PORT) || 4180;
const LIMITS = { maxDelayMs: 10_000, maxPayloadKb: 5_120, maxPageSize: 50 };
// Only what GitHub Pages publishes is served, so local and deployed behave alike.
// The practice pages call the API from another port, so every API response carries CORS headers, and
// the headers a page may want to read (Retry-After, rate-limit info, size) are exposed explicitly.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, Content-Encoding, Content-Length',
};
const PUBLISHED = new Set(['index.html', 'pages', 'assets']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'products.json'), 'utf8'));
const startedAt = Date.now();
let requestCount = 0;

// ---- state that makes user journeys and capacity limits possible (all in memory) ---------------
const users = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'login-users.json'), 'utf8'));
const FREE_SHIPPING_FROM = 10_000; // cents, same rule as the shop page
const STANDARD_SHIPPING = 599;
const sessions = new Map(); // token -> { username, role, cart: Map(productId -> qty) }
const orders = []; // { id, username, items, subtotal, shipping, total }
let orderCounter = 1000; // the first order is ORD-1001, like the shop page
const rateWindows = new Map(); // "key|limit|window" -> { start, count }
const queues = new Map(); // "key|workers" -> { active, waiting: [{ resolve }] }

function resetState() {
  sessions.clear();
  orders.length = 0;
  orderCounter = 1000;
  rateWindows.clear();
  queues.clear();
}

// ---- helpers --------------------------------------------------------------------------------
/** A handler result with an explicit status code (anything else returned is sent as 200 JSON). */
class Reply {
  constructor(status, body, headers = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Deterministic pseudo-random number in [0, 1) for a (seed, i) pair, so results do not depend on request order. */
function seeded(seed, i) {
  let t = (Math.imul(seed | 0, 0x9e3779b1) + Math.imul(i | 0, 0x85ebca6b) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random source for a request: reproducible when ?seed is given (and ?i selects the n-th value). */
function randomFor(params) {
  if (!params.has('seed')) return Math.random;
  const seed = integer(params, 'seed', 0, -2_147_483_648, 2_147_483_647);
  const i = integer(params, 'i', 0, 0, Number.MAX_SAFE_INTEGER);
  return () => seeded(seed, i);
}

function number(params, name, fallback, min, max) {
  if (!params.has(name)) return fallback;
  const raw = params.get(name);
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new HttpError(400, `${name} must be a number between ${min} and ${max}`);
  return value;
}

function integer(params, name, fallback, min, max) {
  const value = number(params, name, fallback, min, max);
  if (!Number.isInteger(value)) throw new HttpError(400, `${name} must be a whole number`);
  return value;
}

function sendJSON(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers });
  res.end(data);
}

/** 204 and 304 must not carry a body. */
function sendReply(res, { status, body, headers }) {
  const allHeaders = { ...CORS, ...headers };
  if (status === 204 || status === 304) {
    res.writeHead(status, allHeaders);
    res.end();
  } else {
    sendJSON(res, status, body, allHeaders);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads and parses a JSON request body (at most 100 KB). An empty body counts as {}. */
function readJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(new HttpError(413, 'Body too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        resolve(body);
      } catch {
        reject(new HttpError(400, 'Body must be a JSON object'));
      }
    });
    req.on('error', reject);
  });
}

function bearerToken(req) {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
  return match ? match[1] : null;
}

function requireSession(req) {
  const session = sessions.get(bearerToken(req));
  if (!session) throw new HttpError(401, 'Missing or invalid token');
  return session;
}

function cartView(session) {
  const items = [...session.cart].map(([productId, qty]) => {
    const product = products.find((p) => p.id === productId);
    return { productId, name: product.name, qty, unitPrice: product.price, lineTotal: product.price * qty };
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = items.length === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : STANDARD_SHIPPING;
  return { items, subtotal, shipping, total: subtotal + shipping };
}

function positiveInt(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new HttpError(400, `${name} must be a whole number of at least 1`);
  return value;
}

/** Takes a worker slot; waits in a FIFO queue when all `workers` are busy. */
function acquireSlot(queue, workers) {
  if (queue.active < workers) {
    queue.active++;
    return { granted: Promise.resolve(true), cancel() {} };
  }
  let entry;
  const granted = new Promise((resolve) => {
    entry = { resolve };
    queue.waiting.push(entry);
  });
  return {
    granted,
    cancel() {
      const index = queue.waiting.indexOf(entry);
      if (index >= 0) queue.waiting.splice(index, 1);
      entry.resolve(false); // the client left while waiting
    },
  };
}

/** Hands the slot straight to the next waiting request, or frees it. */
function releaseSlot(queue) {
  const next = queue.waiting.shift();
  if (next) next.resolve(true);
  else queue.active--;
}

// ---- API routes -----------------------------------------------------------------------------
const routes = [
  ['GET', /^\/api\/health$/, async () => ({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    requests: requestCount,
  })],

  ['GET', /^\/api\/products$/, async ({ params }) => {
    const size = integer(params, 'size', 5, 1, LIMITS.maxPageSize);
    const page = integer(params, 'page', 1, 1, 1_000_000);
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const category = params.get('category') ?? '';
    const matches = products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) && (!category || p.category === category));
    return { page, size, total: matches.length, items: matches.slice((page - 1) * size, page * size) };
  }],

  ['GET', /^\/api\/products\/(\d+)$/, async ({ match }) => {
    const product = products.find((p) => p.id === Number(match[1]));
    if (!product) throw new HttpError(404, 'Product not found');
    return product;
  }],

  // Fixed latency plus random jitter: /api/slow?ms=300&jitter=100&seed=1&i=7
  ['GET', /^\/api\/slow$/, async ({ params }) => {
    const ms = number(params, 'ms', 300, 0, LIMITS.maxDelayMs);
    const jitter = number(params, 'jitter', 0, 0, LIMITS.maxDelayMs);
    if (ms + jitter > LIMITS.maxDelayMs) throw new HttpError(400, `ms + jitter must not exceed ${LIMITS.maxDelayMs}`);
    const delayMs = Math.round(ms + randomFor(params)() * jitter);
    await sleep(delayMs);
    return { delayMs };
  }],

  // Fails a share of requests with 500: /api/flaky?rate=0.2&seed=1&i=7
  ['GET', /^\/api\/flaky$/, async ({ params }) => {
    const rate = number(params, 'rate', 0.2, 0, 1);
    if (randomFor(params)() < rate) throw new HttpError(500, 'Simulated failure');
    return { ok: true };
  }],

  ['GET', /^\/api\/status\/(\d{3})$/, async ({ match }) => {
    const code = Number(match[1]);
    if (code < 200 || code > 599) throw new HttpError(400, 'status must be between 200 and 599');
    return new Reply(code, { status: code });
  }],

  // Response size and compression: /api/payload?kb=100&gzip=1
  ['GET', /^\/api\/payload$/, async ({ params, req, res }) => {
    const kb = number(params, 'kb', 10, 0, LIMITS.maxPayloadKb);
    // Random-looking text (so gzip helps, but not absurdly); reproducible with ?seed.
    const seed = params.has('seed') ? integer(params, 'seed', 0, -2_147_483_648, 2_147_483_647) : null;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
    const length = Math.round(kb * 1024);
    const letters = new Array(length);
    for (let n = 0; n < length; n++) letters[n] = chars[Math.floor((seed === null ? Math.random() : seeded(seed, n)) * chars.length)];
    const body = letters.join('');
    const headers = { 'Content-Type': 'text/plain; charset=utf-8', ...CORS };
    const wantsGzip = params.get('gzip') === '1' && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const data = wantsGzip ? zlib.gzipSync(body) : Buffer.from(body);
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    res.end(data);
    return undefined; // already sent
  }],
  // ---- user journey: login -> browse -> cart -> checkout -----------------------------------------
  ['POST', /^\/api\/login$/, async ({ json }) => {
    const { username, password } = await json();
    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) throw new HttpError(401, 'Invalid username or password');
    if (user.locked) throw new HttpError(423, 'This account is locked');
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, { username: user.username, role: user.role, cart: new Map() });
    return { token, user: { username: user.username, role: user.role } };
  }],

  ['GET', /^\/api\/me$/, async ({ req }) => {
    const { username, role } = requireSession(req);
    return { username, role };
  }],

  ['GET', /^\/api\/cart$/, async ({ req }) => cartView(requireSession(req))],

  ['POST', /^\/api\/cart\/items$/, async ({ req, json }) => {
    const session = requireSession(req);
    const body = await json();
    const productId = positiveInt(body.productId, 'productId');
    const qty = positiveInt(body.qty ?? 1, 'qty');
    const product = products.find((p) => p.id === productId);
    if (!product) throw new HttpError(404, 'Product not found');
    if (product.stock === 0) throw new HttpError(409, 'Out of stock');
    const total = (session.cart.get(productId) ?? 0) + qty;
    if (total > product.stock) throw new HttpError(409, `Only ${product.stock} in stock`);
    session.cart.set(productId, total);
    return new Reply(201, cartView(session));
  }],

  ['DELETE', /^\/api\/cart\/items\/(\d+)$/, async ({ req, match }) => {
    const session = requireSession(req);
    if (!session.cart.delete(Number(match[1]))) throw new HttpError(404, 'Item is not in the cart');
    return cartView(session);
  }],

  ['POST', /^\/api\/checkout$/, async ({ req }) => {
    const session = requireSession(req);
    const cart = cartView(session);
    if (cart.items.length === 0) throw new HttpError(400, 'Cart is empty');
    const order = { id: `ORD-${++orderCounter}`, username: session.username, ...cart };
    orders.push(order);
    session.cart.clear();
    return new Reply(201, order);
  }],

  ['GET', /^\/api\/orders$/, async ({ req }) => {
    const { username } = requireSession(req);
    return { orders: orders.filter((o) => o.username === username) };
  }],

  // ---- capacity limits ----------------------------------------------------------------------------
  // Fixed-window rate limit: /api/limited?limit=5&window=10&key=vu-1
  ['GET', /^\/api\/limited$/, async ({ req, params }) => {
    const limit = integer(params, 'limit', 5, 1, 1000);
    const windowSec = integer(params, 'window', 10, 1, 60);
    const key = params.get('key') ?? bearerToken(req) ?? 'anonymous';
    if (key.length > 64) throw new HttpError(400, 'key must be at most 64 characters');
    const bucket = `${key}|${limit}|${windowSec}`;
    const now = Date.now();
    if (rateWindows.size > 1000) {
      for (const [name, w] of rateWindows) if (now - w.start >= 60_000) rateWindows.delete(name);
    }
    let window = rateWindows.get(bucket);
    if (!window || now - window.start >= windowSec * 1000) {
      window = { start: now, count: 0 };
      rateWindows.set(bucket, window);
    }
    window.count++;
    const retryAfter = Math.max(1, Math.ceil((window.start + windowSec * 1000 - now) / 1000));
    const headers = {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - window.count)),
    };
    if (window.count > limit) return new Reply(429, { error: 'Too many requests', retryAfterSeconds: retryAfter }, { ...headers, 'Retry-After': String(retryAfter) });
    return new Reply(200, { ok: true, remaining: limit - window.count }, headers);
  }],

  // A resource with limited capacity: `workers` requests are served at once, each taking `ms`,
  // everyone else waits in line. Capacity is workers / ms * 1000 requests per second.
  // /api/queue?workers=2&ms=200&maxQueue=500&key=default   (each key is a separate resource)
  ['GET', /^\/api\/queue$/, async ({ res, params }) => {
    const workers = integer(params, 'workers', 2, 1, 20);
    const ms = number(params, 'ms', 200, 0, LIMITS.maxDelayMs);
    const maxQueue = integer(params, 'maxQueue', 500, 0, 10_000);
    const key = params.get('key') ?? 'default';
    if (key.length > 64) throw new HttpError(400, 'key must be at most 64 characters');
    const id = `${key}|${workers}`;
    if (!queues.has(id)) queues.set(id, { active: 0, waiting: [] });
    const queue = queues.get(id);
    if (queue.active >= workers && queue.waiting.length >= maxQueue) {
      return new Reply(503, { error: 'Queue is full' }, { 'Retry-After': '1' });
    }
    const enqueuedAt = Date.now();
    const slot = acquireSlot(queue, workers);
    res.on('close', () => {
      if (!res.writableEnded) slot.cancel();
    });
    if (!(await slot.granted)) return undefined; // the client gave up while waiting
    const waitedMs = Date.now() - enqueuedAt;
    try {
      await sleep(ms);
    } finally {
      releaseSlot(queue);
    }
    return { workers, serviceMs: ms, waitedMs, totalMs: Date.now() - enqueuedAt };
  }],

  // ---- diagnostics and test support --------------------------------------------------------------
  ['GET', /^\/api\/_state$/, async () => ({
    sessions: sessions.size,
    orders: orders.length,
    rateBuckets: rateWindows.size,
    queues: Object.fromEntries([...queues].map(([id, q]) => [id, { active: q.active, waiting: q.waiting.length }])),
  })],

  ['POST', /^\/api\/_reset$/, async () => {
    resetState();
    return { reset: true };
  }],
];

async function handleApi(req, res, url) {
  const params = url.searchParams;
  let pathMatched = false;
  for (const [method, pattern, handler] of routes) {
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    pathMatched = true;
    if (method !== req.method) continue;
    const result = await handler({ req, res, params, match, json: () => readJSON(req) });
    if (result instanceof Reply) sendReply(res, result);
    else if (result !== undefined) sendJSON(res, 200, result, CORS);
    return;
  }
  throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Method not allowed' : 'Unknown endpoint');
}

// ---- static files (the same files GitHub Pages publishes) -------------------------------------
function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    throw new HttpError(400, 'Bad path');
  }
  const file = path.resolve(ROOT, relative);
  const inside = file.startsWith(ROOT + path.sep);
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!inside || !PUBLISHED.has(top) || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new HttpError(404, 'Not found');
  const data = fs.readFileSync(file);
  // Server-Timing lets the practice pages detect (without a request) that this server also hosts the API.
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': data.length,
    'Server-Timing': 'practice-api;desc="Served by the practice server"',
  });
  res.end(req.method === 'HEAD' ? undefined : data);
}

function createServer() {
  return http.createServer(async (req, res) => {
    requestCount++;
    const url = new URL(req.url, `http://${HOST}`);
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
        res.end();
      } else if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) sendJSON(res, status, { error: err instanceof HttpError ? err.message : 'Internal error' }, CORS);
      else res.end();
    }
  });
}

module.exports = { createServer, LIMITS, HOST, PORT };

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => console.log(`Practice API on http://${HOST}:${PORT}  (Ctrl+C to stop)`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
