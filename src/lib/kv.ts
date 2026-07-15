export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

function createMemoryStore(): KvStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

let store: KvStore | null = null;

/**
 * Single swap point for the storage backend. Ships as an in-memory store so
 * the app runs with zero external provisioning; wire real persistence for a
 * production deploy by implementing KvStore against @vercel/kv or Netlify
 * Blobs and returning it here instead (see docs/architecture.md). Nothing
 * outside this file needs to change — src/pages/api/links*.ts only ever
 * calls get/set.
 */
export function getKv(): KvStore {
  if (!store) store = createMemoryStore();
  return store;
}
