// Module-level Map = one cache per server process, which is exactly what the spec calls
// for at this stage (local dev, single process). Ported concept from
// WC-2026-live-tracker/functions/_lib/cache.mjs, simplified: that version cached at the
// edge (Cloudflare `caches.default`) with stale-if-error; we don't need that here because
// error handling happens one level up, in the route handler (Promise.allSettled).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry || Date.now() >= entry.expiresAt) return undefined;
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}

export const LIVE_TTL_MS = 30_000;
export const STATIC_TTL_MS = 300_000;
export const LEADERS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — see plan's Global Constraints

export function matchesTtlMs(matches: Array<{ status: string }>): number {
  const hasLive = matches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return hasLive ? LIVE_TTL_MS : STATIC_TTL_MS;
}
