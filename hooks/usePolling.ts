'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCached } from '@/lib/cache';

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  // Runs the same fetch the interval would, immediately — for a manual "Refresh" button
  // that bypasses the cache TTL without the caller needing to know anything about it.
  refetch: () => void;
  // Timestamp (Date.now()) of the last fetch that actually succeeded — lets a "Refresh"
  // button show *when* it last synced, not just whether one is in flight right now.
  // null until the very first fetch resolves.
  lastSyncedAt: number | null;
}

interface CacheOptions<T> {
  key: string;
  // A fixed TTL, or a function of the fetched result — e.g. a live match's detail is
  // stale in 30s, but a finished/not-yet-started one barely changes and can be held
  // far longer, and that distinction is only knowable after the fetch resolves.
  ttlMs: number | ((result: T) => number);
}

// Every top-level page (Today/Schedule/Standings) is a separate route — navigating
// between them via the nav links unmounts and remounts the whole component, so `data`
// always restarted at null and a spinner flashed even though the server's own cache
// (lib/cache.ts) had the response ready instantly. Seeding from that same cache module
// (imported here, so it's the client-bundle's own in-memory copy) lets a remount render
// the last-known data immediately while `run()` still refreshes it in the background.
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number | null, cache?: CacheOptions<T>): UsePollingResult<T> {
  const cachedRef = useRef<T | undefined>(cache ? getCached<T>(cache.key) : undefined);
  const [data, setData] = useState<T | null>(cachedRef.current ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(cachedRef.current === undefined);
  // Left null even when seeded from cache (below) — this hook instance genuinely
  // doesn't know when that cached value was originally fetched, and the mount-time
  // run() a few lines down will set an accurate timestamp within moments anyway.
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // [React] Stores the latest fetcher without putting it in the effect's dependency
  // array. Inline functions get a new identity every render — if `fetcher` itself were a
  // dependency, the effect (and its setInterval) would tear down and rebuild on every
  // single render, not just when intervalMs actually changes. This ref sidesteps that.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  });

  // [React] Holds the current effect run's `run` function so `refetch()` (called from
  // outside the effect, e.g. a button's onClick) can trigger the same fetch-and-cache
  // logic on demand. Reassigned every time the effect below re-runs, so it's always the
  // version closed over the current `cancelled` flag.
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    // [React] `cancelled` is this run's private flag. If intervalMs changes (or the
    // component unmounts) before an in-flight fetch resolves, its result is discarded
    // instead of overwriting newer state.
    let cancelled = false;

    async function run() {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
          setLastSyncedAt(Date.now());
          if (cacheRef.current) {
            const { key, ttlMs } = cacheRef.current;
            setCached(key, result, typeof ttlMs === 'function' ? ttlMs(result) : ttlMs);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runRef.current = run;
    run();

    if (intervalMs === null) {
      return () => { cancelled = true; };
    }

    const id = setInterval(run, intervalMs);
    // [React] The cleanup function runs before the next effect (when intervalMs
    // changes) and on unmount — this is the only place the interval is ever cleared,
    // which is what prevents a leaked timer from firing after the component is gone.
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  const refetch = useCallback(() => { setLoading(true); runRef.current(); }, []);

  return { data, error, loading, refetch, lastSyncedAt };
}
