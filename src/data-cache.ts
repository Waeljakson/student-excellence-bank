export type CacheVersions = Record<string, string | null | undefined>;

export type DataCacheEnvelope<T extends Record<string, unknown>> = {
  schema: number;
  savedAt: number;
  versions: CacheVersions;
  data: T;
};

const CACHE_SCHEMA = 3;
const CACHE_PREFIX = "mishkat-data-cache-v3:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function cacheKey(scope: string) {
  return `${CACHE_PREFIX}${scope}`;
}

export function readDataCache<T extends Record<string, unknown>>(scope: string): DataCacheEnvelope<T> | null {
  if (!scope) return null;
  try {
    const raw = localStorage.getItem(cacheKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DataCacheEnvelope<T>;
    if (!parsed || parsed.schema !== CACHE_SCHEMA || !parsed.data || !parsed.versions) {
      localStorage.removeItem(cacheKey(scope));
      return null;
    }
    if (Date.now() - Number(parsed.savedAt || 0) > MAX_AGE_MS) {
      localStorage.removeItem(cacheKey(scope));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDataCache<T extends Record<string, unknown>>(
  scope: string,
  versions: CacheVersions,
  data: T,
) {
  if (!scope) return;
  try {
    const payload: DataCacheEnvelope<T> = {
      schema: CACHE_SCHEMA,
      savedAt: Date.now(),
      versions,
      data,
    };
    localStorage.setItem(cacheKey(scope), JSON.stringify(payload));
  } catch {
    // Storage can be blocked or full on some devices. The app keeps working without cache.
  }
}

export function sameCacheVersion(a: CacheVersions, b: CacheVersions, key: string) {
  return String(a?.[key] ?? "") === String(b?.[key] ?? "");
}
