import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const mockParams = { id: '2026-08-22_hullcityafc' };
let mockSearchParams = new URLSearchParams({ espnId: '740966', slug: 'eng.1' });

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useSearchParams: () => mockSearchParams,
}));

import MatchDetailPage from './page';

beforeEach(() => vi.useFakeTimers());
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
