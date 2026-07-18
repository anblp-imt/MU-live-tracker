import { describe, it, expect } from 'vitest';
import { recentForm } from './standings';
import type { Match } from './types';

function match(id: string, utcDate: string, competition: Match['competition'], status: Match['status'], venue: 'H' | 'A', homeScore: number | null, awayScore: number | null): Match {
  return {
    id, utcDate, status, competition, venue,
    home: { name: 'Manchester United FC' }, away: { name: 'Opponent' },
    score: { fullTime: { home: homeScore, away: awayScore }, display: { home: homeScore, away: awayScore } },
    sources: { fd: 1 },
  };
}

describe('recentForm', () => {
  it('maps a win, draw, and loss correctly from MU\'s perspective (home and away)', () => {
    const matches = [
      match('a', '2026-08-01T00:00:00Z', 'PL', 'FINISHED', 'H', 2, 0), // MU won at home
      match('b', '2026-08-08T00:00:00Z', 'PL', 'FINISHED', 'A', 1, 1), // MU drew away
      match('c', '2026-08-15T00:00:00Z', 'PL', 'FINISHED', 'H', 0, 1), // MU lost at home
    ];
    expect(recentForm(matches, 'PL')).toEqual(['W', 'D', 'L']);
  });

  it('takes only the last N finished matches, oldest-first within that window', () => {
    const matches = Array.from({ length: 7 }, (_, i) =>
      match(`m${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'PL', 'FINISHED', 'H', i, 0),
    );
    expect(recentForm(matches, 'PL', 5)).toHaveLength(5);
  });

  it('ignores matches from other competitions and matches that have not finished', () => {
    const matches = [
      match('a', '2026-08-01T00:00:00Z', 'PL', 'FINISHED', 'H', 1, 0),
      match('b', '2026-08-08T00:00:00Z', 'CL', 'FINISHED', 'H', 1, 0),
      match('c', '2026-08-15T00:00:00Z', 'PL', 'SCHEDULED', 'H', null, null),
    ];
    expect(recentForm(matches, 'PL')).toEqual(['W']);
  });

  it('returns an empty array when there are no finished matches in this competition', () => {
    expect(recentForm([], 'PL')).toEqual([]);
  });
});
