import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SchedulePage from './page';
import { CompetitionFilterProvider } from '@/contexts/CompetitionFilterContext';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => vi.unstubAllGlobals());

function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string): MatchesResponse['matches'][number] {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('SchedulePage', () => {
  it('shows all matches by default (ALL from the shared context)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Manchester United FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<CompetitionFilterProvider><SchedulePage /></CompetitionFilterProvider>);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
  });
});
