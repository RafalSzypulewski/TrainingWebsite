'use strict';
/*
 * Runs a k6 script against the practice server, starting the server first when it is not
 * already running, and stopping it afterwards.
 *
 *   node perf/run.js perf/k6/smoke.ts            (npm run perf:smoke)
 *   node perf/run.js perf/k6/smoke.ts --vus 3    (extra arguments go to k6)
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = Number(process.env.PERF_PORT) || 4180;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const [script, ...k6Args] = process.argv.slice(2);

if (!script) {
  console.error('Usage: node perf/run.js <k6 script> [k6 arguments]');
  process.exit(2);
}

async function isUp() {
  try {
    return (await fetch(`${BASE_URL}/api/health`)).ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function main() {
  let server = null;
  if (await isUp()) {
    console.log(`Using the practice server that is already running on ${BASE_URL}`);
  } else {
    server = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], {
      env: { ...process.env, PERF_PORT: String(PORT) },
      stdio: 'ignore',
    });
    if (!(await waitUntilUp(5000))) {
      server.kill();
      console.error(`The practice server did not start on ${BASE_URL} (is the port in use?)`);
      return 1;
    }
    console.log(`Started the practice server on ${BASE_URL}`);
  }

  const code = await new Promise((resolve) => {
    const k6 = spawn('k6', ['run', script, '-e', `BASE_URL=${BASE_URL}`, ...k6Args], { stdio: 'inherit' });
    k6.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(
          'k6 was not found. Install it first:\n' +
            '  Windows: winget install GrafanaLabs.k6\n' +
            '  macOS:   brew install k6\n' +
            '  Linux / Docker: https://grafana.com/docs/k6/latest/set-up/install-k6/',
        );
      } else {
        console.error(err);
      }
      resolve(127);
    });
    k6.on('exit', (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)));
  });

  if (server) server.kill();
  return code;
}

main().then((code) => process.exit(code));
