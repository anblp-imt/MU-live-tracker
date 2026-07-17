'use client';
import { useEffect, useRef, useState } from 'react';

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number | null): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // [React] Stores the latest fetcher without putting it in the effect's dependency
  // array. Inline functions get a new identity every render — if `fetcher` itself were a
  // dependency, the effect (and its setInterval) would tear down and rebuild on every
  // single render, not just when intervalMs actually changes. This ref sidesteps that.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
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
