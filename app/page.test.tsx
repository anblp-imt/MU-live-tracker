import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TodayPage from './page';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function response(matches: MatchesResponse['matches']): MatchesResponse {
  return { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
}

describe('TodayPage', () => {
  it('shows a loading state before the fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<TodayPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows only matches scheduled for today, from MU\'s perspective', async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => response([
        { id: 't', utcDate: `${today}T15:00:00Z`, status: 'SCHEDULED', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 1 } },
        { id: 'later', utcDate: '2099-01-01T15:00:00Z', status: 'SCHEDULED', competition: 'PL', home: { name: 'Everton FC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 2 } },
      ]),
    }));

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/Hull City/)).toBeInTheDocument());
    expect(screen.queryByText(/Everton/)).not.toBeInTheDocument();
  });

  it('shows an error message if the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<TodayPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
