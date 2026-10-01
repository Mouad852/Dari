/**
 * Full-stack smoke harness (launch task 6.2a).
 *
 * Every other Playwright spec runs the web app against e2e/mock-api.mjs, so
 * nothing proves that the web and the real API still agree -- the class of bug
 * behind P0-2, P0-4 and P0-5. This starts the real stack on the host, in order,
 * and runs the specs in this directory against it:
 *
 *   1. a throwaway PostGIS container (not the dev `dari-db` and its volume),
 *   2. the Firebase Auth emulator (free; the "demo-" project never reaches a
 *      real Firebase project),
 *   3. the API from source (`mvnw spring-boot:run`) in emulator mode,
 *   4. the web app (`next dev`) signing in against the emulator,
 *
 * then tears all of it down, whatever the outcome. Logs go to
 * <tmp>/dari-full-stack/. Needs Docker running and the ports below free.
 *
 * Usage (from apps/web): npm run e2e:full-stack [-- <playwright args>]
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PORTS, PROJECT_ID, SSR_SECRET, URLS } from './stack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', '..');
const apiDir = path.resolve(webDir, '..', 'api');
const repoDir = path.resolve(webDir, '..', '..');
const logDir = path.join(os.tmpdir(), 'dari-full-stack');
mkdirSync(logDir, { recursive: true });

const DB_CONTAINER = 'dari-fullstack-db';
const isWindows = process.platform === 'win32';
const children = [];

function log(message) {
  console.log(`[full-stack] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(what, check, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // A process that already died will never become ready: say so now.
    if (child && child.exitCode !== null) {
      throw new Error(`${what} exited with code ${child.exitCode} before it was ready (logs: ${logDir})`);
    }
    try {
      if (await check()) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error(`${what} did not become ready within ${timeoutMs / 1000} s (logs: ${logDir})`);
}

async function answers(url) {
  const response = await fetch(url);
  return response.ok;
}

function docker(...args) {
  return spawnSync('docker', args, { encoding: 'utf8' });
}

/** A long-running process whose output goes to <logDir>/<name>.log. */
function start(name, command, args, options) {
  const out = openSync(path.join(logDir, `${name}.log`), 'w');
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', out, out],
    shell: isWindows,
    detached: !isWindows,
  });
  children.push({ name, child });
  child.on('exit', (code) => {
    if (!stopping) log(`${name} exited early with code ${code} (see ${name}.log)`);
  });
  return child;
}

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const { name, child } of children.reverse()) {
    if (child.exitCode !== null) continue;
    log(`stopping ${name}`);
    // The commands are shells running mvnw/npx/next: stop the whole tree.
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    }
  }
  docker('rm', '-f', DB_CONTAINER);
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

async function main() {
  const version = docker('info', '--format', '{{.ServerVersion}}');
  if (version.status !== 0) throw new Error('Docker is not running; start Docker Desktop first.');

  log(`database on ${PORTS.db}`);
  docker('rm', '-f', DB_CONTAINER);
  const init = path.join(repoDir, 'infra', 'db', 'init').replace(/\\/g, '/');
  const run = docker('run', '-d', '--name', DB_CONTAINER,
    '-e', 'POSTGRES_DB=dari', '-e', 'POSTGRES_USER=dari', '-e', 'POSTGRES_PASSWORD=dari_local',
    '-p', `${PORTS.db}:5432`, '-v', `${init}:/docker-entrypoint-initdb.d:ro`, 'postgis/postgis:16-3.4');
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr}`);
  // The image serves a temporary server during init, then restarts: wait for the real one.
  const initComplete = () => {
    const logs = docker('logs', DB_CONTAINER);
    return `${logs.stdout}${logs.stderr}`.includes('PostgreSQL init process complete');
  };
  await waitFor('PostGIS', () => initComplete()
    && docker('exec', DB_CONTAINER, 'pg_isready', '-U', 'dari', '-d', 'dari').status === 0, 120_000);

  log(`Firebase Auth emulator on ${PORTS.emulator}`);
  const emulator = start('emulator', 'npx', ['-y', 'firebase-tools@13', 'emulators:start', '--only', 'auth',
    '--project', PROJECT_ID, '--config', path.join(here, 'firebase.json')], { cwd: here });
  await waitFor('Auth emulator', () => answers(`${URLS.emulator}/`), 180_000, emulator);

  log(`API on ${PORTS.api} (first run compiles; a few minutes)`);
  // By absolute path: cmd.exe skips the working directory when
  // NoDefaultCurrentDirectoryInExePath is set.
  const api = start('api', path.join(apiDir, isWindows ? 'mvnw.cmd' : 'mvnw'), ['-q', 'spring-boot:run'], {
    cwd: apiDir,
    env: {
      ...process.env,
      DB_URL: `jdbc:postgresql://127.0.0.1:${PORTS.db}/dari`,
      POSTGRES_USER: 'dari',
      POSTGRES_PASSWORD: 'dari_local',
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${PORTS.emulator}`,
      SERVER_PORT: String(PORTS.api),
      DARI_WEB_ORIGIN: URLS.web,
      DARI_SSR_SHARED_SECRET: SSR_SECRET,
      DARI_UPLOAD_DIR: path.join(logDir, 'uploads'),
      DARI_NOTIFICATIONS_ENABLED: 'false',
    },
  });
  await waitFor('API', () => answers(`${URLS.api}/actuator/health`), 420_000, api);

  log(`web on ${PORTS.web}`);
  const web = start('web', 'npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(PORTS.web)], {
    cwd: webDir,
    env: {
      ...process.env,
      API_BASE_URL: `${URLS.api}/api/v1`,
      NEXT_PUBLIC_API_BASE_URL: `${URLS.api}/api/v1`,
      NEXT_PUBLIC_SITE_URL: URLS.web,
      NEXT_PUBLIC_MEDIA_ORIGINS: URLS.api,
      DARI_SSR_SHARED_SECRET: SSR_SECRET,
      NEXT_PUBLIC_FIREBASE_API_KEY: 'full-stack-emulator-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${PORTS.emulator}`,
      NEXT_PUBLIC_E2E_TEST_MODE: '',
      ...JSON.parse(readFileSync(path.join(here, 'legal-placeholders.json'), 'utf8')),
    },
  });
  await waitFor('web', () => answers(URLS.web), 180_000, web);

  log('running the full-stack specs');
  const result = spawnSync('npx', ['playwright', 'test', '-c', 'e2e/full-stack.config.ts', ...process.argv.slice(2)], {
    cwd: webDir,
    stdio: 'inherit',
    shell: isWindows,
  });
  return result.status ?? 1;
}

let code = 1;
try {
  code = await main();
} catch (error) {
  console.error(`[full-stack] ${error instanceof Error ? error.message : error}`);
} finally {
  stopAll();
}
process.exit(code);
