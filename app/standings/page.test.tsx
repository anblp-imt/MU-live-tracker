import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandingsPage from './page';

afterEach(() => vi.unstubAllGlobals());

describe('StandingsPage', () => {
  it('loads the PL table by default', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [{ position: 1, team: { name: 'AFC Bournemouth' }, playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalDifference: 0 }] }) });
      }
      return Promise.resolve({ json: async () => ({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } }) });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getByText('AFC Bournemouth')).toBeInTheDocument());
  });

  it('switches to a cup run when the FA tab is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: [] }) });
      return Promise.resolve({
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

    await userEvent.click(screen.getByRole('tab', { name: 'FA' }));
    await waitFor(() => expect(screen.getByText(/Some Opponent/)).toBeInTheDocument());
  });
});
