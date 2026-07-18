import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import TodayPage from './page';
import type { MatchesResponse } from '@/lib/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function response(overrides: Partial<MatchesResponse> = {}): MatchesResponse {
  return { season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } }, ...overrides };
}

describe('TodayPage', () => {
  it('shows a loading state before the first fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<TodayPage />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows only today\'s matches from the fetched data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response({ matches: [
        { id: 't', utcDate: `${today}T15:00:00Z`, status: 'SCHEDULED', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 1 } },
      ] }),
    }));

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Hull City/)).toBeInTheDocument();
  });

  it('shows a partial-source banner when ESPN enrichment is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ meta: { sources: { fd: true, espn: false } } }),
    }));

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/ESPN enrichment unavailable/)).toBeInTheDocument();
  });

  it('keeps showing the last known data and a retry banner when a later poll fails', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => response({ matches: [
        { id: 't', utcDate: `${today}T15:00:00Z`, status: 'IN_PLAY', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'H', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } }, minute: '10', sources: { fd: 1 } },
      ] }) })
      .mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    // The interval-change effect (data → setIntervalMs(30_000) → usePolling's [intervalMs]
    // effect tears down and re-runs) calls run() immediately per usePolling's own design, so
    // the second fetch (landing on the rejected mock) fires here, before any timer advances.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A live match sets the interval to 30s (LIVE_POLL_MS) — advance past it.
    await act(async () => { vi.advanceTimersByTime(30_000); await Promise.resolve(); });

    expect(screen.getByRole('alert')).toHaveTextContent(/refresh failed/i);
    // Old data must still be visible, not replaced by a blank/error page.
    expect(screen.getByText(/Manchester United FC/)).toBeInTheDocument();
  });
});
