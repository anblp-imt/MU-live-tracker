import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { clearCache } from '@/lib/cache';

const mockParams = { id: '2026-08-22_hullcityafc' };
let mockSearchParams = new URLSearchParams({ espnId: '740966', slug: 'eng.1' });

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useSearchParams: () => mockSearchParams,
}));

import MatchDetailPage from './page';

// usePolling's client cache is a module-level Map shared across every test in this file
// (several reuse the same espnId/slug) — clear it so each test starts from a real fetch,
// except the one test below that deliberately exercises the cache.
beforeEach(() => { clearCache(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); mockSearchParams = new URLSearchParams({ espnId: '740966', slug: 'eng.1' }); });

describe('MatchDetailPage', () => {
  it('shows an unavailable message when espnId/slug are missing (FD-only fixture)', () => {
    mockSearchParams = new URLSearchParams();
    render(<MatchDetailPage />);
    expect(screen.getByText(/detail unavailable/i)).toBeInTheDocument();
  });

  it('renders scorers and lineups once the detail loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '1' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '2' },
            ],
            details: [{ scoringPlay: true, clock: { displayValue: "33'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }] }],
          }],
        },
        rosters: [
          { homeAway: 'home', team: { displayName: 'Brighton' }, formation: '4-2-3-1', roster: [] },
          { homeAway: 'away', team: { displayName: 'Manchester United' }, formation: '4-2-3-1', roster: [] },
        ],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/Patrick Dorgu/)).toBeInTheDocument();
    expect(screen.getByTestId('formation-pitch')).toBeInTheDocument();
    expect(screen.getAllByText('Red Devils').length).toBeGreaterThan(0);
    expect(screen.getByText('Brighton & Hove Albion')).toBeInTheDocument();
    expect(screen.getByText(/1 – 2/)).toBeInTheDocument();
    expect(screen.getByText('Full Time')).toBeInTheDocument();
  });

  it('renders stats, substitutions and a penalty shootout when the detail includes them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '1', shootoutScore: '3' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '1', shootoutScore: '4' },
            ],
          }],
        },
        rosters: [],
        boxscore: {
          teams: [
            { homeAway: 'home', statistics: [{ name: 'totalShots', displayValue: '10' }] },
            { homeAway: 'away', statistics: [{ name: 'totalShots', displayValue: '14' }] },
          ],
        },
        keyEvents: [{
          type: { type: 'substitution' }, clock: { displayValue: "60'", value: 3600 },
          team: { id: '360' }, participants: [{ athlete: { displayName: 'Amad Diallo' } }, { athlete: { displayName: 'Antony' } }],
        }],
        shootout: [
          { id: '331', team: 'Brighton & Hove Albion', shots: [{ player: 'A', didScore: true }] },
          { id: '360', team: 'Manchester United', shots: [{ player: 'B', didScore: true }] },
        ],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('stats')).toBeInTheDocument();
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByTestId('substitutions')).toBeInTheDocument();
    expect(screen.getByText('1 Substitution')).toBeInTheDocument();
    expect(screen.getByText(/Amad Diallo/)).toBeInTheDocument();
    expect(screen.getByTestId('shootout')).toBeInTheDocument();
    expect(screen.getByText('3 – 4')).toBeInTheDocument();
  });

  it('omits stats/substitutions/shootout sections when the detail has none of that data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '1' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '2' },
            ],
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByTestId('stats')).not.toBeInTheDocument();
    expect(screen.queryByTestId('substitutions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shootout')).not.toBeInTheDocument();
  });

  it('keeps polling and updates once a pre-match fixture goes live', async () => {
    const preDetail = {
      header: { competitions: [{ status: { type: { state: 'pre' } }, competitors: [] }] },
      rosters: [],
    };
    const liveDetail = {
      header: { competitions: [{ status: { type: { state: 'in' }, displayClock: '5\'' }, competitors: [] }] },
      rosters: [],
    };
    let resolveSecondFetch: (v: unknown) => void = () => {};
    const secondFetch = new Promise(resolve => { resolveSecondFetch = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preDetail })
      .mockImplementationOnce(() => secondFetch);
    vi.stubGlobal('fetch', fetchMock);

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Kickoff soon')).toBeInTheDocument();
    // Second fetch (triggered by the pre-match poll interval kicking in) is deliberately
    // held open, proving it happened at all — before the fix, intervalMs stayed null and
    // this second call never fired.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveSecondFetch({ ok: true, json: async () => liveDetail });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(/Live/)).toBeInTheDocument();
  });

  it('opens the lineup by default before kickoff, closes it once live', async () => {
    const preDetail = {
      header: { competitions: [{ status: { type: { state: 'pre' } }, competitors: [] }] },
      rosters: [],
    };
    const liveDetail = {
      header: { competitions: [{ status: { type: { state: 'in' }, displayClock: '5\'' }, competitors: [] }] },
      rosters: [],
    };
    let resolveSecondFetch: (v: unknown) => void = () => {};
    const secondFetch = new Promise(resolve => { resolveSecondFetch = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preDetail })
      .mockImplementationOnce(() => secondFetch);
    vi.stubGlobal('fetch', fetchMock);

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Starting Lineup').closest('details')).toHaveAttribute('open');

    resolveSecondFetch({ ok: true, json: async () => liveDetail });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Starting Lineup').closest('details')).not.toHaveAttribute('open');
  });

  it('renders instantly from cache when the same fixture is reopened', async () => {
    const detail = {
      header: { competitions: [{ status: { type: { state: 'post' } }, competitors: [] }] },
      rosters: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => detail }));

    const { unmount } = render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Full Time')).toBeInTheDocument();
    unmount();

    // Simulates navigating back out to Today and clicking straight back into the same
    // fixture: no fetch has resolved yet for this new mount, so if the page were still
    // relying purely on the fresh fetch it would render the loading spinner here.
    const stillLoadingFetch = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', stillLoadingFetch);
    render(<MatchDetailPage />);
    expect(screen.getByText('Full Time')).toBeInTheDocument();
  });

  it('shows an error message when the detail fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<MatchDetailPage />);
    // [React] waitFor polls via setTimeout, which never fires under vi.useFakeTimers()
    // unless the clock is advanced — matches the fake-timers precedent already
    // established in app/page.test.tsx (Task 21): flush microtasks with act() instead,
    // since this resolution needs no real/fake timer, only a settled promise.
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
