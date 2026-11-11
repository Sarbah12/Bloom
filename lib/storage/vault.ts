import { getRandomBytes } from 'expo-crypto';

import { storageBackend } from './backend';
import { newKey, open, seal } from './crypto';

/**
 * The vault: one encrypted file holding all of a person's health records.
 *
 * Writes go to a scratch copy first, then the real file, so a crash mid-write
 * leaves at least one readable copy. If neither can be opened (for example the
 * phone was restored from a backup, which carries the file but deliberately not
 * the key), `loadVault` reports it and the app starts fresh rather than
 * crashing — without the key the old file can never be read anyway.
 */
const KEY_NAME = 'bloom.vault-key.v1';
const FILE = 'bloom.vault';
const SCRATCH = 'bloom.vault.next';

const random = (n: number) => getRandomBytes(n);

async function getOrCreateKey(): Promise<string> {
  const existing = await storageBackend.getSecret(KEY_NAME);
  if (existing) return existing;
  const key = newKey(random);
  await storageBackend.setSecret(KEY_NAME, key);
  return key;
}

export type LoadResult<T> = { status: 'empty' } | { status: 'ok'; data: T } | { status: 'unreadable' };

export async function loadVault<T>(): Promise<LoadResult<T>> {
  const key = await storageBackend.getSecret(KEY_NAME);
  const main = await storageBackend.readFile(FILE);
  const scratch = await storageBackend.readFile(SCRATCH);
  if (!main && !scratch) return { status: 'empty' };
  if (!key) return { status: 'unreadable' };

  for (const sealed of [main, scratch]) {
    if (!sealed) continue;
    try {
      return { status: 'ok', data: JSON.parse(open(key, sealed)) as T };
    } catch {
      // try the other copy
    }
  }
  return { status: 'unreadable' };
}

export async function saveVault<T>(data: T): Promise<void> {
  const key = await getOrCreateKey();
  const sealed = seal(key, JSON.stringify(data), random);
  await storageBackend.writeFile(SCRATCH, sealed);
  await storageBackend.writeFile(FILE, sealed);
  await storageBackend.deleteFile(SCRATCH);
}

/** Removes the data and the key. Nothing can be recovered afterwards. */
export async function destroyVault(): Promise<void> {
  await storageBackend.deleteFile(FILE);
  await storageBackend.deleteFile(SCRATCH);
  await storageBackend.deleteSecret(KEY_NAME);
}

export const vaultIsDeviceSecure = storageBackend.isPersistentAndSecure;
