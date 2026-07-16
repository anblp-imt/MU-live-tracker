import { describe, it, expect } from 'vitest';
import { COMPETITIONS, getCompetition, competitionIdForFdCode } from './competitions';

describe('competitions mapping', () => {
  it('lists all 5 competitions with an ESPN slug', () => {
    expect(COMPETITIONS).toHaveLength(5);
    expect(COMPETITIONS.every(c => c.espnSlug.length > 0)).toBe(true);
  });

  it('getCompetition returns the Premier League mapping', () => {
    expect(getCompetition('PL')).toMatchObject({ espnSlug: 'eng.1', hasStandings: true });
  });

  it('getCompetition throws for an unknown id', () => {
    // @ts-expect-error deliberately invalid id to test the runtime guard
    expect(() => getCompetition('XX')).toThrow();
  });

  it('competitionIdForFdCode maps PL and CL, and returns undefined for cup codes not covered by FD', () => {
    expect(competitionIdForFdCode('PL')).toBe('PL');
    expect(competitionIdForFdCode('CL')).toBe('CL');
    expect(competitionIdForFdCode('FA')).toBeUndefined();
  });
});
