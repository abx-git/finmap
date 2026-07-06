const TTL_MS = 15 * 60 * 1000;
const store = new Map<string, { data: unknown; timestamp: number }>();

export function getMemoryCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setMemoryCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}
