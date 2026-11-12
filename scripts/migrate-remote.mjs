#!/usr/bin/env node
/**
 * Applies new SQL migrations to the hosted Supabase (self-hosted on Railway)
 * through its admin SQL route, recording each one so it only runs once.
 *
 *   SUPABASE_URL=https://… SUPABASE_SERVICE_ROLE_KEY=… npm run migrate:remote
 *
 * The service-role key bypasses row-level security: never put it in the app
 * or in git. Copy it from Railway (kong service variables) or Studio →
 * Project Settings → API when you need it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

async function sql(query) {
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text || '[]');
}

const dir = join(new URL('..', import.meta.url).pathname, 'supabase/migrations');
await sql(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz default now());`);
const applied = new Set((await sql('select version from supabase_migrations.schema_migrations')).map((r) => r.version));

const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let ran = 0;
for (const f of files) {
  const version = f.split('_')[0];
  if (applied.has(version)) continue;
  const body = readFileSync(join(dir, f), 'utf8');
  const name = f.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/'/g, '');
  // One request: the migration and its record succeed or fail together.
  await sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}');\ncommit;`);
  console.log(`applied ${f}`);
  ran++;
}
console.log(ran ? `${ran} migration${ran === 1 ? '' : 's'} applied` : `up to date (${files.length} migrations)`);
