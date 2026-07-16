import { describe, it, expect } from 'vitest';
import { matchKey, computeDisplayScore } from './merge';
import type { FdMatch } from './types';

describe('matchKey', () => {
  it('combines the UTC date (day only) with the normalized opponent name', () => {
    expect(matchKey('2026-08-22T11:30:00Z', 'Hull City AFC')).toBe('2026-08-22_hullcityafc');
  });

  it('normalizes accents/case so both sources produce the same key', () => {
    expect(matchKey('2026-10-01T19:00:00Z', 'Bayern München')).toBe(
      matchKey('2026-10-01T19:00:00Z', 'BAYERN MUENCHEN'.replace('UE', 'Ü')),
    );
  });
});

describe('computeDisplayScore', () => {
  it('uses fullTime for a normal REGULAR finish', () => {
    const score: FdMatch['score'] = { duration: 'REGULAR', fullTime: { home: 2, away: 1 } };
    expect(computeDisplayScore(score)).toEqual({ home: 2, away: 1 });
  });

  it('uses fullTime for an EXTRA_TIME finish (no shootout)', () => {
    const score: FdMatch['score'] = { duration: 'EXTRA_TIME', fullTime: { home: 3, away: 2 } };
    expect(computeDisplayScore(score)).toEqual({ home: 3, away: 2 });
  });

  it('sums regularTime + extraTime for a PENALTY_SHOOTOUT finish, ignoring fullTime', () => {
    // fullTime would include shootout goals here (e.g. 5-4) — the pre-penalty score is 1-1.
    const score: FdMatch['score'] = {
      duration: 'PENALTY_SHOOTOUT',
      fullTime: { home: 5, away: 4 },
      regularTime: { home: 1, away: 1 },
      extraTime: { home: 0, away: 0 },
    };
    expect(computeDisplayScore(score)).toEqual({ home: 1, away: 1 });
  });
});
