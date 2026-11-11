import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/**
 * Native storage: the encryption key lives in the iOS Keychain / Android
 * Keystore-backed SecureStore, marked "this device only" so it never leaves the
 * phone in a backup. The sealed data lives in the app's private documents
 * folder. Without the key, a copied file is unreadable.
 */
const secretOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const storageBackend = {
  isPersistentAndSecure: true,

  getSecret(name: string): Promise<string | null> {
    return SecureStore.getItemAsync(name, secretOptions);
  },

  setSecret(name: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(name, value, secretOptions);
  },

  deleteSecret(name: string): Promise<void> {
    return SecureStore.deleteItemAsync(name, secretOptions);
  },

  async readFile(name: string): Promise<string | null> {
    const file = new File(Paths.document, name);
    return file.exists ? file.text() : null;
  },

  async writeFile(name: string, contents: string): Promise<void> {
    const file = new File(Paths.document, name);
    if (!file.exists) file.create();
    file.write(contents);
  },

  async deleteFile(name: string): Promise<void> {
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
  },
};
