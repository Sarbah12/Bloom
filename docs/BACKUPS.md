# Database backups

Railway's built-in volume backups need the Pro plan, so Bloom backs up its
own database instead. It works on any Railway plan and gives a portable,
encrypted copy.

## How it works

- **Service:** `bloom-backup` in the Railway project `bloom` (source:
  [`backup/`](../backup)). A cron service: Railway starts it at **03:00 UTC
  every night**, it runs once and exits.
- **What it does:** `pg_dump` (custom format) of the whole database over
  Railway's private network → checks the dump can be read (`pg_restore
  --list`) → encrypts it with AES-256 (OpenSSL, PBKDF2, 600,000 iterations)
  → uploads to the private bucket `bloom-backups` (US West, same region as
  the database) → deletes copies older than `RETENTION_DAYS` (30).
- **Each file:** `postgres/bloom-<UTC time>.dump.enc`, with the SHA-256 of the
  decrypted dump and the table count stored as metadata.
- **Secrets** (bloom-backup service Variables): `BACKUP_PASSPHRASE`, bucket
  credentials, and the database password (a reference to the Postgres
  service). **Copy `BACKUP_PASSPHRASE` into your password manager** — without
  it the backups can't be decrypted.

## Check it's working

- Railway → `bloom-backup` → Deployments: a run every night, logs ending in
  `backup: done`.
- `npm run backup:restore -- --list` lists the backups in the bucket.

## Test a restore (do this every few months)

```
npm run backup:restore
```

Downloads the latest backup, checks its checksum, decrypts it and restores
Bloom's tables, sign-in users and migration records into a throwaway local
PostgreSQL 17, then reports what came back and deletes it. Needs the Railway
CLI logged in and `brew install postgresql@17`.

Last tested: **2026-11-12** — `bloom-2026-11-12T082541Z`: 12 public tables,
all with row-level security, 13 policies, `auth.users` present, 4 migrations,
no errors. (The database held no user data yet, so the test proved structure,
policies and the migration rows round-trip.)

## Real disaster restore

1. `npm run backup:restore -- --key postgres/bloom-<time>.dump.enc --keep`
   keeps the decrypted dump in the project folder (it holds health data —
   delete it afterwards; it is ignored by git).
2. In Railway, add a fresh Postgres service from the same image
   (`supabase/postgres:17.6.1.136`) with the same `POSTGRES_PASSWORD`,
   `JWT_SECRET` and `JWT_EXP` as the old one.
3. Restore into it (from a machine that can reach it, e.g. via a temporary
   TCP proxy that you remove afterwards):
   `pg_restore --clean --if-exists -d <connection> bloom-restore-….dump`
4. Point the auth, rest, storage and meta services at the new database
   (their database URL variables), redeploy, and run the RLS tests.
5. Remove the temporary proxy and delete the local dump.
