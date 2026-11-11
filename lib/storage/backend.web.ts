/**
 * Web storage exists only so the app can be previewed in a browser during
 * development. It keeps the key next to the data in localStorage, which is NOT
 * secure — the mobile apps use the Keychain/Keystore instead. The UI says so.
 */
function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();

function get(name: string): string | null {
  const s = store();
  try {
    return s ? s.getItem(name) : (memory.get(name) ?? null);
  } catch {
    return memory.get(name) ?? null;
  }
}

function set(name: string, value: string): void {
  const s = store();
  try {
    if (s) s.setItem(name, value);
    else memory.set(name, value);
  } catch {
    memory.set(name, value);
  }
}

function remove(name: string): void {
  memory.delete(name);
  try {
    store()?.removeItem(name);
  } catch {
    // nothing stored
  }
}

export const storageBackend = {
  isPersistentAndSecure: false,
  getSecret: async (name: string) => get(`secret:${name}`),
  setSecret: async (name: string, value: string) => set(`secret:${name}`, value),
  deleteSecret: async (name: string) => remove(`secret:${name}`),
  readFile: async (name: string) => get(`file:${name}`),
  writeFile: async (name: string, contents: string) => set(`file:${name}`, contents),
  deleteFile: async (name: string) => remove(`file:${name}`),
};
