import "server-only";
import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "quotes");
const TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp < TTL_MS) {
      return entry.data;
    }
  } catch {
    // cache miss
  }
  return null;
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
}

export function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}
