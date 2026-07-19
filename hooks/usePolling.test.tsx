import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { usePolling } from './usePolling';
import { clearCache, getCached } from '@/lib/cache';

function Probe({ fetcher, intervalMs, cache }: { fetcher: () => Promise<string>; intervalMs: number | null; cache?: { key: string; ttlMs: number | ((result: string) => number) } }) {
  const { data, error, loading, refetch } = usePolling(fetcher, intervalMs, cache);
  return (
    <div>
      <span>{loading ? 'loading' : error ? `error:${error.message}` : `data:${data}`}</span>
      <button onClick={refetch}>refetch</button>
    </div>
  );
}

beforeEach(() => { vi.useFakeTimers(); clearCache(); });
afterEach(() => vi.useRealTimers());

describe('usePolling', () => {
  it('fetches once immediately on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue('first');
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText('data:first')).toBeInTheDocument();
  });

  it('does not schedule another fetch when intervalMs is null', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches on the given interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('clears the interval on unmount (no further fetches)', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { unmount } = render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected fetch as an error without crashing', async () => {
    // Note: plain `waitFor` hangs here because @testing-library/dom's fake-timer
    // detection only recognizes Jest (`typeof jest !== 'undefined'`), not Vitest's
    // `vi.useFakeTimers()`. It falls back to a real `setInterval` poll, which is
    // itself faked and never fires. The rejection settles on the microtask queue
    // (unaffected by fake timers either way), so flushing microtasks is enough.
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('error:boom')).toBeInTheDocument();
  });

  it('restarts the interval when intervalMs changes', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { rerender } = render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // The effect re-runs synchronously on this dependency change and calls run()
    // unconditionally at the top (same as on mount), so this rerender itself
    // fires an immediate refetch before any time is advanced.
    rerender(<Probe fetcher={fetcher} intervalMs={5000} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Old 1000ms interval must be gone — advancing by 1000ms alone must NOT refetch.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // New 5000ms interval fires (4000ms remaining after the 1000ms already advanced).
    await act(async () => { vi.advanceTimersByTime(4000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('renders a cached value immediately on mount instead of the loading state', async () => {
    const cache = { key: 'probe', ttlMs: 60_000 };
    // Simulates the scenario this was built for: a previous mount (e.g. before the user
    // navigated to another page and back) already populated the cache.
    const seedFetcher = vi.fn().mockResolvedValue('cached-value');
    const { unmount } = render(<Probe fetcher={seedFetcher} intervalMs={null} cache={cache} />);
    await act(async () => { await Promise.resolve(); });
    unmount();

    const freshFetcher = vi.fn().mockResolvedValue('fresh-value');
    render(<Probe fetcher={freshFetcher} intervalMs={null} cache={cache} />);
    // No "loading" flash: cached-value renders on the very first paint, synchronously.
    expect(screen.getByText('data:cached-value')).toBeInTheDocument();

    // The remount still refetches in the background to keep the cache from going stale.
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('data:fresh-value')).toBeInTheDocument();
  });

  it('refetches on demand when refetch() is called, bypassing the interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('refetch'));
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not seed from a differently-keyed or expired cache entry', async () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {}));
    render(<Probe fetcher={fetcher} intervalMs={null} cache={{ key: 'unseen-key', ttlMs: 60_000 }} />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('computes the TTL from the fetched result when ttlMs is a function', async () => {
    // Mirrors the match-detail page: TTL depends on data only knowable after the fetch
    // resolves (e.g. "is this match still live?"), so ttlMs must be able to inspect it.
    const fetcher = vi.fn().mockResolvedValue('live-value');
    const ttlMs = vi.fn((result: string) => (result === 'live-value' ? 30_000 : 300_000));
    render(<Probe fetcher={fetcher} intervalMs={null} cache={{ key: 'dynamic-ttl-key', ttlMs }} />);
    await act(async () => { await Promise.resolve(); });
    expect(ttlMs).toHaveBeenCalledWith('live-value');
    expect(getCached('dynamic-ttl-key')).toBe('live-value');
  });

  it('writes the fetched result to the cache under the given key', async () => {
    const fetcher = vi.fn().mockResolvedValue('written-value');
    render(<Probe fetcher={fetcher} intervalMs={null} cache={{ key: 'write-key', ttlMs: 60_000 }} />);
    await act(async () => { await Promise.resolve(); });
    expect(getCached('write-key')).toBe('written-value');
  });
});
