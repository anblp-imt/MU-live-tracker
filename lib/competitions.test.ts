import { describe, it, expect } from 'vitest';
import { COMPETITIONS, getCompetition, visibleCompetitions } from './competitions';
import type { Match } from './types';

function match(competition: Match['competition']): Match {
  return {
    id: 'x', utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('COMPETITIONS', () => {
  it('defines EL and ECL as ESPN-only, no standings, no fdCode — same pattern as FA/EFL', () => {
    const el = getCompetition('EL');
    const ecl = getCompetition('ECL');
    expect(el).toMatchObject({ espnSlug: 'uefa.europa', hasStandings: false });
    expect(el.fdCode).toBeUndefined();
    expect(ecl).toMatchObject({ espnSlug: 'uefa.europa.conf', hasStandings: false });
    expect(ecl.fdCode).toBeUndefined();
  });
});

describe('visibleCompetitions', () => {
  it('always includes non-European competitions, even with zero matches', () => {
    const result = visibleCompetitions([]);
    const ids = result.map(c => c.id);
    expect(ids).toContain('PL');
    expect(ids).toContain('FA');
    expect(ids).toContain('EFL');
    expect(ids).toContain('FRIENDLY');
  });

  it('excludes CL/EL/ECL entirely when MU has no match in any of them', () => {
    const result = visibleCompetitions([match('PL')]);
    const ids = result.map(c => c.id);
    expect(ids).not.toContain('CL');
    expect(ids).not.toContain('EL');
    expect(ids).not.toContain('ECL');
  });

  it('includes only the one European competition MU actually has a match in', () => {
    const result = visibleCompetitions([match('PL'), match('EL')]);
    const ids = result.map(c => c.id);
    expect(ids).toContain('EL');
    expect(ids).not.toContain('CL');
    expect(ids).not.toContain('ECL');
  });

  it('preserves COMPETITIONS declaration order (PL, then whichever European slot, then FA, EFL, FRIENDLY)', () => {
    const result = visibleCompetitions([match('PL'), match('CL')]);
    expect(result.map(c => c.id)).toEqual(['PL', 'CL', 'FA', 'EFL', 'FRIENDLY']);
  });

  it('accepts a pre-filtered candidate list via the second parameter, still applying the European rule', () => {
    const noFriendly = COMPETITIONS.filter(c => c.id !== 'FRIENDLY');
    const result = visibleCompetitions([match('PL')], noFriendly);
    expect(result.map(c => c.id)).toEqual(['PL', 'FA', 'EFL']);
  });
});
