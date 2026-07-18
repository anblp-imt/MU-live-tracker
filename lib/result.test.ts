import { describe, it, expect } from 'vitest';
import { matchResult } from './result';
import type { Match } from './types';

function match(status: Match['status'], venue: 'H' | 'A', homeScore: number | null, awayScore: number | null): Match {
  return {
    id: 'x', utcDate: '2026-08-01T00:00:00Z', status, competition: 'PL', venue,
    home: { name: 'Manchester United FC' }, away: { name: 'Opponent' },
    score: { fullTime: { home: homeScore, away: awayScore }, display: { home: homeScore, away: awayScore } },
    sources: { fd: 1 },
  };
}

describe('matchResult', () => {
  it('is "W" when MU wins at home', () => {
    expect(matchResult(match('FINISHED', 'H', 2, 0))).toBe('W');
  });

  it('is "L" when MU loses away', () => {
    expect(matchResult(match('FINISHED', 'A', 2, 0))).toBe('L');
  });

  it('is "D" on a draw', () => {
    expect(matchResult(match('FINISHED', 'H', 1, 1))).toBe('D');
  });

  it('is null when the match has not finished', () => {
    expect(matchResult(match('SCHEDULED', 'H', null, null))).toBeNull();
    expect(matchResult(match('IN_PLAY', 'H', 1, 0))).toBeNull();
  });

  it('is null when a score is missing even if marked FINISHED', () => {
    expect(matchResult(match('FINISHED', 'H', null, 0))).toBeNull();
  });
});
