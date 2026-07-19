import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import StatsPage from './page';
import { clearCache } from '@/lib/cache';
import type { Match, MatchesResponse, SeasonLeaders } from '@/lib/types';

// usePolling's client cache is a module-level Map shared across every test in this file
// (and with app/page.test.tsx / app/schedule/page.test.tsx, which use the same
// 'matches' cache key) — clear it so each test starts from a real fetch.
beforeEach(() => clearCache());
afterEach(() => vi.unstubAllGlobals());

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'x',
    utcDate: '2026-08-22T11:30:00Z',
    status: 'FINISHED',
    competition: 'PL',
    home: { name: 'Hull City AFC' },
    away: { name: 'Manchester United FC' },
    venue: 'A',
    score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } },
    sources: { fd: 1 },
    ...overrides,
  };
}

function stubMatches(matches: Match[]) {
  const response: MatchesResponse = { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
}

function stubMatchesAndLeaders(matches: Match[], leaders: SeasonLeaders) {
  const matchesResponse: MatchesResponse = { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/leaders')) return Promise.resolve({ ok: true, json: async () => leaders });
    return Promise.resolve({ ok: true, json: async () => matchesResponse });
  }));
}

describe('StatsPage', () => {
  it('shows a loading state before the first fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<StatsPage />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows the ALL-competition tally by default', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL', venue: 'A', score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } } }),
      match({ id: 'b', competition: 'CL', venue: 'H', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } } }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('tab', { name: 'ALL', selected: true })).toBeInTheDocument();
    expect(screen.getByTestId('stat-played')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-won')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-drawn')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalsFor')).toHaveTextContent('2');
    // Match a is an away win (MU 2, Hull 1) per lib/seasonStats.test.ts's own fixture
    // comment; match b is a 0-0 draw. GA/GD corrected from the brief's fixture (which
    // asserted GA=2/GD=0 — impossible for a match with unequal GF/GA scored as a win).
    expect(screen.getByTestId('stat-goalsAgainst')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalDifference')).toHaveTextContent('1');
  });

  it('filters to one competition when its tab is clicked', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL', score: { fullTime: { home: 5, away: 5 }, display: { home: 5, away: 5 } } }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('tab', { name: 'PL' }));
    expect(screen.getByTestId('stat-played')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalsFor')).toHaveTextContent('2');
  });

  it('shows an empty state when the selected competition has no finished matches yet', async () => {
    stubMatches([match({ competition: 'PL', status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } })]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/no finished matches yet/i)).toBeInTheDocument();
  });

  it('excludes friendlies from the ALL tally and has no Friendly tab', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'FRIENDLY', score: { fullTime: { home: 9, away: 9 }, display: { home: 9, away: 9 } } }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('stat-played')).toHaveTextContent('1');
    expect(screen.queryByRole('tab', { name: 'Friendly' })).not.toBeInTheDocument();
  });

  it('refetches when the Refresh button is clicked', async () => {
    stubMatches([match()]);
    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ season: '2026-27', matches: [match(), match({ id: 'b' })], meta: { sources: { fd: true, espn: true } } }) });
    vi.stubGlobal('fetch', fetchMock);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await act(async () => { await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByTestId('stat-played')).toHaveTextContent('2');
  });

  it('only shows a European tab (CL/EL/ECL) when MU actually has a match in one', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'ECL' }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('tab', { name: 'UECL' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UCL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UEL' })).not.toBeInTheDocument();
  });

  it('shows Season Leaders once /api/leaders resolves', async () => {
    stubMatchesAndLeaders([match()], {
      topScorers: [{ name: 'Bruno Fernandes', count: 5 }],
      topAssists: [{ name: 'Amad Diallo', count: 3 }],
      topYellowCards: [{ name: 'Casemiro', count: 2 }],
    });

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Bruno Fernandes')).toBeInTheDocument();
    expect(screen.getByText('Amad Diallo')).toBeInTheDocument();
    expect(screen.getByText('Casemiro')).toBeInTheDocument();
  });

  it('shows an empty state for a leader category with no data yet', async () => {
    stubMatchesAndLeaders([match()], { topScorers: [], topAssists: [], topYellowCards: [] });

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getAllByText(/no data yet/i).length).toBeGreaterThan(0);
  });
});
