import { describe, it, expect } from 'vitest';
import { groupMatchesByMonth } from './schedule';
import type { Match } from './types';

function match(id: string, utcDate: string): Match {
  return {
    id, utcDate, status: 'SCHEDULED', competition: 'PL',
    home: { name: 'Manchester United FC' }, away: { name: 'Opponent' }, venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('groupMatchesByMonth', () => {
  it('groups matches into month buckets with a human-readable label', () => {
    const groups = groupMatchesByMonth([
      match('a', '2026-07-18T15:00:00Z'),
      match('b', '2026-08-22T11:30:00Z'),
    ]);
    expect(groups.map(g => g.label)).toEqual(['July 2026', 'August 2026']);
  });

  it('sorts groups chronologically regardless of input order', () => {
    const groups = groupMatchesByMonth([
      match('b', '2026-08-22T11:30:00Z'),
      match('a', '2026-07-18T15:00:00Z'),
    ]);
    expect(groups.map(g => g.label)).toEqual(['July 2026', 'August 2026']);
  });

  it('keeps matches from the same month together and sorted by date', () => {
    const groups = groupMatchesByMonth([
      match('b', '2026-08-22T11:30:00Z'),
      match('a', '2026-08-01T15:00:00Z'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array for no matches', () => {
    expect(groupMatchesByMonth([])).toEqual([]);
  });
});
