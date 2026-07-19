import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandingsPage from './page';
import { clearCache } from '@/lib/cache';

// usePolling's client cache is a module-level Map shared across every test in this file
// — without clearing it, a previous test's mocked matches/standings could leak into the
// next one via the 'matches'/'standings:*' cache keys.
beforeEach(() => clearCache());
afterEach(() => vi.unstubAllGlobals());

function standingsRow(position: number, teamName: string) {
  return { position, team: { name: teamName }, playedGames: 14, won: 0, draw: 0, lost: 0, points: 0, goalDifference: 0 };
}

describe('StandingsPage', () => {
  it('loads the PL table by default', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [standingsRow(1, 'AFC Bournemouth')] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } }) });
    }));

    render(<StandingsPage />);
    // getAllByText, not getByText: the same row renders once in the desktop table and
    // once in the mobile card list (both always in the DOM, toggled by CSS media query).
    await waitFor(() => expect(screen.getAllByText('AFC Bournemouth').length).toBeGreaterThan(0));
  });

  it('shows Manchester United as "Red Devils" with its own recent form', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [standingsRow(1, 'Arsenal FC'), standingsRow(2, 'Manchester United FC')] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'm1', utcDate: '2026-08-01T15:00:00Z', status: 'FINISHED', competition: 'PL',
            home: { name: 'Manchester United FC' }, away: { name: 'Arsenal FC' }, venue: 'H',
            score: { fullTime: { home: 2, away: 0 }, display: { home: 2, away: 0 } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByText('Red Devils').length).toBeGreaterThan(0));
    expect(screen.queryByText('Manchester United FC')).not.toBeInTheDocument();
    expect(screen.getAllByText('W').length).toBeGreaterThan(0);
  });

  it('shows a "Red Devils\' Position" highlight block on the CL tab, but not on PL', async () => {
    const bigTable = Array.from({ length: 36 }, (_, i) =>
      i === 17 ? standingsRow(18, 'Manchester United FC') : standingsRow(i + 1, `Team ${i + 1}`),
    );
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: bigTable }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'cl1', utcDate: '2026-09-17T19:00:00Z', status: 'SCHEDULED', competition: 'CL',
            home: { name: 'Manchester United FC' }, away: { name: 'Some European Side' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByText('Red Devils').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Red Devils' Position/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'UCL' }));
    await waitFor(() => expect(screen.getByText(/Red Devils' Position/)).toBeInTheDocument());

    // Scope to the highlight block itself — the full table below still lists all 36
    // teams regardless of tab, so an unscoped query can't tell "windowed to Team 16-20"
    // apart from "present somewhere on the page."
    const highlight = within(screen.getByTestId('cl-highlight'));
    expect(highlight.getByText('Team 16')).toBeInTheDocument();
    expect(highlight.getByText('Team 20')).toBeInTheDocument();
    expect(highlight.queryByText('Team 1')).not.toBeInTheDocument();
  });

  it('only shows a European tab (CL/EL/ECL) when MU actually has a match in one, and routes it to CupRun', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: [] }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'el1', utcDate: '2026-09-17T19:00:00Z', status: 'SCHEDULED', competition: 'EL',
            home: { name: 'Manchester United FC' }, away: { name: 'Some Europa Side' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    expect(screen.getByRole('tab', { name: 'UEL' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UCL' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'UEL' }));
    await waitFor(() => expect(screen.getByText(/Some Europa Side/)).toBeInTheDocument());
  });

  it('switches to a cup run when the FA tab is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: [] }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'fa1', utcDate: '2026-11-01T15:00:00Z', status: 'SCHEDULED', competition: 'FA',
            home: { name: 'Manchester United FC' }, away: { name: 'Some Opponent' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole('tab', { name: 'FA Cup' }));
    await waitFor(() => expect(screen.getByText(/Some Opponent/)).toBeInTheDocument());
  });
});
