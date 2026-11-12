#!/usr/bin/env node
/**
 * Downloads an encrypted database backup from the Railway bucket, decrypts it
 * and restores it into a throwaway local PostgreSQL 17, then prints what came
 * back — so a restore is tested, not assumed.
 *
 *   npm run backup:restore                 # latest backup, restore test
 *   npm run backup:restore -- --list       # list backups
 *   npm run backup:restore -- --key postgres/bloom-….dump.enc
 *   npm run backup:restore -- --keep       # also keep the decrypted .dump
 *
 * Needs: the Railway CLI logged in to the bloom project, openssl, and
 * PostgreSQL 17 client tools (Homebrew postgresql@17). Bucket credentials and
 * the passphrase are read through the CLI and never printed.
 *
 * For a real disaster restore, use the kept .dump with pg_restore into a fresh
 * supabase/postgres 17 service (see docs/BACKUPS.md).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const PG = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/local/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin'].find((d) =>
  existsSync(join(d, 'pg_restore')),
);
if (!PG) throw new Error('PostgreSQL 17 client tools not found (brew install postgresql@17).');
const bin = (n) => join(PG, n);

const railway = (...a) => execFileSync('railway', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const creds = JSON.parse(railway('bucket', 'credentials', '-b', 'bloom-backups', '--json'));
const passphrase = JSON.parse(railway('variables', '-s', 'bloom-backup', '--json')).BACKUP_PASSPHRASE;
if (!passphrase) throw new Error('BACKUP_PASSPHRASE not found on the bloom-backup service.');

// --- Minimal S3 (SigV4) client: list and get ---------------------------------
const endpoint = new URL(creds.endpoint);
const region = creds.region || 'auto';
const sha = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

async function s3(path, query = '') {
  const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = now.slice(0, 8);
  const host = creds.urlStyle === 'virtual' ? `${creds.bucketName}.${endpoint.host}` : endpoint.host;
  const uri = creds.urlStyle === 'virtual' ? path : `/${creds.bucketName}${path}`;
  const headers = { host, 'x-amz-content-sha256': sha(''), 'x-amz-date': now };
  const signed = Object.keys(headers).sort();
  const canonical = [
    'GET',
    uri,
    query,
    ...signed.map((h) => `${h}:${headers[h]}`),
    '',
    signed.join(';'),
    headers['x-amz-content-sha256'],
  ].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', now, scope, sha(canonical)].join('\n');
  const key = ['s3', 'aws4_request'].reduce((k, d) => hmac(k, d), hmac(hmac(`AWS4${creds.secretAccessKey}`, date), region));
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  const r = await fetch(`${endpoint.protocol}//${host}${uri}${query ? `?${query}` : ''}`, {
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}`,
    },
  });
  if (!r.ok) throw new Error(`S3 ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

const listXml = await (await s3('/', 'list-type=2&prefix=postgres%2F')).text();
const field = (xml, tag) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? '';
const objects = [...listXml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
  .map((m) => ({ key: field(m[1], 'Key'), at: field(m[1], 'LastModified'), size: Number(field(m[1], 'Size')) }))
  .sort((a, b) => a.key.localeCompare(b.key));
if (flag('--list')) {
  for (const o of objects) console.log(`${o.key}  ${(o.size / 1024).toFixed(0)} KB  ${o.at}`);
  process.exit(0);
}
const chosen = opt('--key') ? objects.find((o) => o.key === opt('--key')) : objects[objects.length - 1];
if (!chosen) throw new Error('No backup found.');
console.log(`restore: using ${chosen.key} (${(chosen.size / 1024).toFixed(0)} KB, ${chosen.at})`);

const res = await s3(`/${chosen.key.split('/').map(encodeURIComponent).join('/')}`);
const expected = res.headers.get('x-amz-meta-sha256');
const work = mkdtempSync(join(tmpdir(), 'bloom-restore-'));
const enc = join(work, 'backup.dump.enc');
const dump = join(work, 'backup.dump');
writeFileSync(enc, Buffer.from(await res.arrayBuffer()));

execFileSync(
  'openssl',
  [
    'enc',
    '-d',
    '-aes-256-cbc',
    '-pbkdf2',
    '-iter',
    '600000',
    '-md',
    'sha256',
    '-in',
    enc,
    '-out',
    dump,
    '-pass',
    'env:BLOOM_BACKUP_PASSPHRASE',
  ],
  {
    env: { ...process.env, BLOOM_BACKUP_PASSPHRASE: passphrase },
  },
);
const actual = sha(readFileSync(dump));
if (expected && expected !== actual) throw new Error('Checksum mismatch: the backup is corrupt or the passphrase is wrong.');
console.log(`restore: decrypted, checksum ${expected ? 'matches' : 'not recorded'}`);

// --- Restore into a throwaway cluster ---------------------------------------
const data = join(work, 'pg');
const port = String(55000 + Math.floor(Math.random() * 900));
const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' };
const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stderr}`);
  return r.stdout;
};
let started = false;
try {
  run(bin('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '-E', 'UTF8']);
  run(bin('pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${work} -c listen_addresses=''`, '-w', '-l', join(work, 'log'), 'start']);
  started = true;
  const psql = (sql) =>
    run(bin('psql'), ['-h', work, '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql]);
  // Supabase's API roles, so row-level security policies restore as they are.
  psql(
    'do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;',
  );
  // Selective restores don't create schemas; make the ones Bloom's data lives in.
  psql(
    'create schema if not exists auth; create schema if not exists extensions; create schema if not exists supabase_migrations; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions;',
  );
  // Bloom's data and the auth users table. Supabase-internal extensions aren't
  // in plain PostgreSQL, so their objects are skipped; that's expected here.
  const restore = spawnSync(
    bin('pg_restore'),
    [
      '-h',
      work,
      '-p',
      port,
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--no-owner',
      '--no-privileges',
      '-n',
      'public',
      '-n',
      'auth',
      '-n',
      'supabase_migrations',
      dump,
    ],
    { encoding: 'utf8', env },
  );
  const skipped = (restore.stderr.match(/^pg_restore: error:/gm) || []).length;
  if (flag('--debug'))
    console.log(
      restore.stderr
        .split('\n')
        .filter((l) => /error|DETAIL|LINE/.test(l))
        .slice(0, 14)
        .join('\n'),
    );
  const report = psql(`select
    (select count(*) from pg_tables where schemaname = 'public') || ' public tables, ' ||
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) || ' with row-level security, ' ||
    (select count(*) from pg_policies where schemaname = 'public') || ' policies, ' ||
    '%USERS%' || ' users, ' ||
    (select count(*) from public.period_logs) || ' periods, ' ||
    (select count(*) from public.daily_logs) || ' check-ins, ' ||
    (select coalesce(string_agg(version, ',' order by version), 'none') from supabase_migrations.schema_migrations) || ' migrations'`);
  const users =
    psql("select to_regclass('auth.users') is not null").trim() === 't'
      ? psql('select count(*) from auth.users').trim()
      : 'NO auth.users table,';
  console.log(`restore: ${report.trim().replace('%USERS%', users)}`);
  console.log(`restore: ${skipped} Supabase-internal objects skipped (expected in plain PostgreSQL)`);
  if (flag('--keep')) {
    const out = join(process.cwd(), `bloom-restore-${chosen.key.split('/').pop().replace('.enc', '')}`);
    writeFileSync(out, readFileSync(dump), { mode: 0o600 });
    console.log(`restore: decrypted dump kept at ${out} — it contains health data; delete it when done`);
  }
} finally {
  if (started) spawnSync(bin('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { encoding: 'utf8', env });
  rmSync(work, { recursive: true, force: true });
}
