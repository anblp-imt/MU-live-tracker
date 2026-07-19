import { describe, it, expect } from 'vitest';
import { computeSeasonStats } from './seasonStats';
import type { Match } from './types';

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

describe('computeSeasonStats', () => {
  it('tallies a win, a draw, and a loss across three finished matches', () => {
    const matches: Match[] = [
      // Away win: MU (away) 2, Hull (home) 1 -> W
      match({ id: 'a', venue: 'A', score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } } }),
      // Home draw: MU (home) 1, opponent (away) 1 -> D
      match({ id: 'b', venue: 'H', score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } } }),
      // Home loss: MU (home) 0, opponent (away) 3 -> L
      match({ id: 'c', venue: 'H', score: { fullTime: { home: 0, away: 3 }, display: { home: 0, away: 3 } } }),
    ];

    const result = computeSeasonStats(matches, 'PL');

    expect(result).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 2 + 1 + 0,
      goalsAgainst: 1 + 1 + 3,
      goalDifference: (2 + 1 + 0) - (1 + 1 + 3),
    });
  });

  it('excludes matches that are not FINISHED', () => {
    const matches: Match[] = [
      match({ id: 'a', status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } }),
      match({ id: 'b', status: 'IN_PLAY', score: { fullTime: { home: 1, away: 0 }, display: { home: 1, away: 0 } } }),
      match({ id: 'c', status: 'FINISHED' }),
    ];

    expect(computeSeasonStats(matches, 'PL').played).toBe(1);
  });

  it('filters to the given competition', () => {
    const matches: Match[] = [
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL' }),
    ];

    expect(computeSeasonStats(matches, 'PL').played).toBe(1);
    expect(computeSeasonStats(matches, 'CL').played).toBe(1);
  });

  it('aggregates every competition when given ALL', () => {
    const matches: Match[] = [
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL' }),
      match({ id: 'c', competition: 'FA' }),
    ];

    expect(computeSeasonStats(matches, 'ALL').played).toBe(3);
  });

  it('returns all zeros for a competition with no finished matches yet', () => {
    const matches: Match[] = [match({ status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } })];

    expect(computeSeasonStats(matches, 'PL')).toEqual({
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
    });
  });
});
