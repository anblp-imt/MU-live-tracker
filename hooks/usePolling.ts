'use client';
import { useEffect, useRef, useState } from 'react';
import { getCached, setCached } from '@/lib/cache';

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

interface CacheOptions {
  key: string;
  ttlMs: number;
}

// Every top-level page (Today/Schedule/Standings) is a separate route — navigating
// between them via the nav links unmounts and remounts the whole component, so `data`
// always restarted at null and a spinner flashed even though the server's own cache
// (lib/cache.ts) had the response ready instantly. Seeding from that same cache module
// (imported here, so it's the client-bundle's own in-memory copy) lets a remount render
// the last-known data immediately while `run()` still refreshes it in the background.
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number | null, cache?: CacheOptions): UsePollingResult<T> {
  const cachedRef = useRef<T | undefined>(cache ? getCached<T>(cache.key) : undefined);
  const [data, setData] = useState<T | null>(cachedRef.current ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(cachedRef.current === undefined);

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
          if (cacheRef.current) setCached(cacheRef.current.key, result, cacheRef.current.ttlMs);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

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

  return { data, error, loading };
}
