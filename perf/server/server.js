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

const ROOT = path.resolve(__dirname, '..', '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PERF_PORT) || 4180;
const LIMITS = { maxDelayMs: 10_000, maxPayloadKb: 5_120, maxPageSize: 50 };
// Only what GitHub Pages publishes is served, so local and deployed behave alike.
const PUBLISHED = new Set(['index.html', 'pages', 'assets']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'products.json'), 'utf8'));
const startedAt = Date.now();
let requestCount = 0;

// ---- helpers --------------------------------------------------------------------------------
/** A handler result with an explicit status code (anything else returned is sent as 200 JSON). */
class Reply {
  constructor(status, body) {
    this.status = status;
    this.body = body;
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
function sendReply(res, { status, body }) {
  if (status === 204 || status === 304) {
    res.writeHead(status, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  } else {
    sendJSON(res, status, body, { 'Access-Control-Allow-Origin': '*' });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' };
    const wantsGzip = params.get('gzip') === '1' && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const data = wantsGzip ? zlib.gzipSync(body) : Buffer.from(body);
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    res.end(data);
    return undefined; // already sent
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
    const result = await handler({ req, res, params, match });
    if (result instanceof Reply) sendReply(res, result);
    else if (result !== undefined) sendJSON(res, 200, result, { 'Access-Control-Allow-Origin': '*' });
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
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

function createServer() {
  return http.createServer(async (req, res) => {
    requestCount++;
    const url = new URL(req.url, `http://${HOST}`);
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' });
        res.end();
      } else if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) sendJSON(res, status, { error: err instanceof HttpError ? err.message : 'Internal error' }, { 'Access-Control-Allow-Origin': '*' });
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
