import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { usePolling } from './usePolling';

function Probe({ fetcher, intervalMs }: { fetcher: () => Promise<string>; intervalMs: number | null }) {
  const { data, error, loading } = usePolling(fetcher, intervalMs);
  return <div>{loading ? 'loading' : error ? `error:${error.message}` : `data:${data}`}</div>;
}

beforeEach(() => vi.useFakeTimers());
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
});
