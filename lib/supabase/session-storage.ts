import { getRandomBytes } from 'expo-crypto';

import { storageBackend } from '@/lib/storage/backend';
import { newKey, open, seal } from '@/lib/storage/crypto';

/**
 * Where the Supabase session (access + refresh token) is kept: encrypted with
 * its own key from the secure keychain, like the health vault. SecureStore
 * alone has a ~2 KB limit on some Android versions, which sessions exceed.
 */
const KEY_NAME = 'bloom.session-key.v1';
const random = (n: number) => getRandomBytes(n);
const fileName = (key: string) => `bloom.auth.${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

async function key(): Promise<string> {
  const existing = await storageBackend.getSecret(KEY_NAME);
  if (existing) return existing;
  const created = newKey(random);
  await storageBackend.setSecret(KEY_NAME, created);
  return created;
}

export const encryptedSessionStorage = {
  async getItem(name: string): Promise<string | null> {
    const sealed = await storageBackend.readFile(fileName(name));
    const k = await storageBackend.getSecret(KEY_NAME);
    if (!sealed || !k) return null;
    try {
      return open(k, sealed);
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    await storageBackend.writeFile(fileName(name), seal(await key(), value, random));
  },
  async removeItem(name: string): Promise<void> {
    await storageBackend.deleteFile(fileName(name));
  },
};
