'use strict';
/*
 * Runs k6 scripts against the practice server, starting the server first when it is not already
 * running, and stopping it afterwards.
 *
 *   node perf/run.js perf/k6/smoke.ts            (npm run perf:smoke)
 *   node perf/run.js perf/k6/smoke.ts --vus 3    (extra arguments go to k6)
 *   node perf/run.js perf/k6/solutions           (a folder: runs every .ts file in it, one after another)
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, explainFile } = require('./explain.js');

const PORT = Number(process.env.PERF_PORT) || 4180;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const [target, ...k6Args] = process.argv.slice(2);

if (!target) {
  console.error('Usage: node perf/run.js <k6 script or folder> [k6 arguments]');
  process.exit(2);
}

function scriptsIn(target) {
  if (!fs.existsSync(target)) {
    console.error(`Not found: ${target}`);
    process.exit(2);
  }
  if (!fs.statSync(target).isDirectory()) return [target];
  return fs.readdirSync(target).filter((f) => f.endsWith('.ts')).sort().map((f) => path.join(target, f));
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

function runK6(script, extraArgs = []) {
  return new Promise((resolve) => {
    const k6 = spawn('k6', ['run', script, '-e', `BASE_URL=${BASE_URL}`, ...extraArgs, ...k6Args], { stdio: 'inherit' });
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
}

/** Says why a script failed. On GitHub Actions the reasons also become annotations on the run and the pull request. */
function reportFailure(script, code, reasons) {
  console.log(`\n${script} FAILED (exit code ${code})${reasons.length ? ', because:' : ''}`);
  for (const reason of reasons) console.log(`  - ${reason}`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const title = `k6: ${path.basename(script)} failed`;
    for (const reason of reasons.length ? reasons : [`exit code ${code}`]) console.log(`::error title=${title}::${reason}`);
  }
}

async function main() {
  const scripts = scriptsIn(target);
  if (scripts.length === 0) {
    console.error(`No .ts scripts in ${target}`);
    return 2;
  }

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

  // k6 writes a summary of every run here, so that a failure can be explained in a few lines.
  const summaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-summary-'));
  const userExports = k6Args.some((arg) => arg.startsWith('--summary-export'));

  const failed = [];
  for (const script of scripts) {
    if (scripts.length > 1) console.log(`\n===== ${script} =====`);
    // Start every script from a clean server state (sessions, carts, rate limits, queues).
    await fetch(`${BASE_URL}/api/_reset`, { method: 'POST' }).catch(() => {});
    const summaryFile = path.join(summaryDir, `${path.basename(script)}.json`);
    const code = await runK6(script, userExports ? [] : [`--summary-export=${summaryFile}`]);
    if (code !== 0) {
      failed.push({ script, code });
      const problems = !userExports && code !== 127 ? explainFile(summaryFile) : null;
      reportFailure(script, code, problems ? describe(problems) : []);
    }
    if (code === 127) break; // k6 itself is missing: no point in trying the rest
  }
  fs.rmSync(summaryDir, { recursive: true, force: true });

  if (server) server.kill();
  if (scripts.length > 1) {
    console.log(failed.length ? `\n${failed.length} of ${scripts.length} scripts failed:\n${failed.map((f) => `  ${f.script} (exit ${f.code})`).join('\n')}` : `\nAll ${scripts.length} scripts passed.`);
  }
  return failed.length ? failed[0].code : 0;
}

main().then((code) => process.exit(code));
