import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from './page';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => vi.unstubAllGlobals());

function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string): MatchesResponse['matches'][number] {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('SchedulePage', () => {
  it('shows all matches by default, then filters when a pill is clicked (lifted state)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Manchester United FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));

    await userEvent.click(screen.getByRole('tab', { name: 'Friendly' }));

    expect(screen.getAllByTestId('match-card')).toHaveLength(1);
    expect(screen.getByText(/Leeds United/)).toBeInTheDocument();
  });
});
