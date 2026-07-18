import { describe, it, expect } from 'vitest';
import { groupMatchesByMonth, isPastMonth } from './schedule';
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

  it('exposes a sortable "YYYY-MM" key alongside the display label', () => {
    const groups = groupMatchesByMonth([match('a', '2026-07-18T15:00:00Z')]);
    expect(groups[0].key).toBe('2026-07');
  });
});

describe('isPastMonth', () => {
  const now = new Date('2026-07-18T12:00:00Z');

  it('is true for a month before the current one', () => {
    expect(isPastMonth('2026-06', now)).toBe(true);
  });

  it('is false for the current month', () => {
    expect(isPastMonth('2026-07', now)).toBe(false);
  });

  it('is false for a future month', () => {
    expect(isPastMonth('2026-08', now)).toBe(false);
  });

  it('handles a past month crossing a year boundary', () => {
    expect(isPastMonth('2025-12', now)).toBe(true);
  });
});
