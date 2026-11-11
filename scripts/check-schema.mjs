#!/usr/bin/env node
/**
 * Applies every migration to a throwaway PostgreSQL server and runs the
 * row-level security tests against it. Needs `initdb`, `pg_ctl` and `psql`
 * (Homebrew `postgresql@16` or newer). Skips with a warning when they are
 * missing, so contributors without Postgres can still run the other checks.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const has = (bin) => spawnSync('which', [bin]).status === 0;
if (!['initdb', 'pg_ctl', 'psql'].every(has)) {
  console.warn('schema: skipped (PostgreSQL tools not installed)');
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'bloom-pg-'));
const data = join(dir, 'data');
const port = String(54000 + Math.floor(Math.random() * 900));
// Postgres on macOS refuses to start without a valid locale in the environment.
const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env, ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
};

let started = false;
try {
  run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-w', '-l', join(dir, 'log'), 'start']);
  started = true;
  const psql = (file) =>
    run('psql', ['-h', dir, '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file]);

  psql(join(root, 'supabase/tests/stub-supabase.sql'));
  const migrations = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const m of migrations) psql(join(root, 'supabase/migrations', m));
  const out = psql(join(root, 'supabase/tests/rls.test.sql'));
  console.log(out.trim().split('\n').pop() + ` (${migrations.length} migration${migrations.length === 1 ? '' : 's'})`);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exitCode = 1;
} finally {
  if (started) spawnSync('pg_ctl', ['-D', data, '-m', 'immediate', 'stop'], { encoding: 'utf8', env });
  rmSync(dir, { recursive: true, force: true });
}
