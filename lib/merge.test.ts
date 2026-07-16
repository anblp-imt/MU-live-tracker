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

import { mergeMatches } from './merge';
import type { EspnScheduleEvent } from './types';

function fd(overrides: Partial<FdMatch> = {}): FdMatch {
  return {
    id: 1,
    utcDate: '2026-08-22T11:30:00Z',
    status: 'SCHEDULED',
    competition: { code: 'PL' },
    homeTeam: { name: 'Hull City AFC' },
    awayTeam: { name: 'Manchester United FC' },
    score: { duration: 'REGULAR', fullTime: { home: null, away: null } },
    ...overrides,
  };
}

function espnEvent(overrides: Partial<EspnScheduleEvent> = {}): EspnScheduleEvent {
  return {
    id: 'e1',
    date: '2026-08-22T11:30:00Z',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: '999', displayName: 'Hull City' } },
        { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' } },
      ],
      status: { type: { state: 'pre' } },
    }],
    ...overrides,
  };
}

describe('mergeMatches', () => {
  it('converts an FD-only match using MU perspective (venue, opponent)', () => {
    const result = mergeMatches([fd()], {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '2026-08-22_hullcityafc',
      competition: 'PL',
      venue: 'A',
      sources: { fd: 1 },
    });
    expect(result[0].sources.espn).toBeUndefined();
  });

  it('enriches an FD match with a matching ESPN event (same fixture, live status wins)', () => {
    const liveEspn = espnEvent({
      competitions: [{
        competitors: espnEvent().competitions[0].competitors,
        status: { type: { state: 'in' }, displayClock: "23'" },
      }],
    });
    const result = mergeMatches([fd()], { PL: [liveEspn] });
    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual({ fd: 1, espn: 'e1' });
    expect(result[0].status).toBe('IN_PLAY');
    expect(result[0].minute).toBe("23'");
  });

  it('includes an ESPN-only friendly fixture with no FD counterpart', () => {
    const friendly = espnEvent({
      id: 'f1',
      date: '2026-07-20T18:00:00Z',
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
          { homeAway: 'away', team: { id: '111', displayName: 'Leeds United' } },
        ],
        status: { type: { state: 'pre' } },
      }],
    });
    const result = mergeMatches([], { FRIENDLY: [friendly] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ competition: 'FRIENDLY', venue: 'H', sources: { espn: 'f1' } });
    expect(result[0].sources.fd).toBeUndefined();
  });

  it('sorts the combined list by utcDate ascending', () => {
    const early = fd({ id: 1, utcDate: '2026-08-22T11:30:00Z', awayTeam: { name: 'Manchester United FC' }, homeTeam: { name: 'Hull City AFC' } });
    const late = fd({ id: 2, utcDate: '2026-09-01T11:30:00Z', awayTeam: { name: 'Manchester United FC' }, homeTeam: { name: 'Everton FC' } });
    const result = mergeMatches([late, early], {});
    expect(result.map(m => m.id)).toEqual([
      matchKey(early.utcDate, 'Hull City AFC'),
      matchKey(late.utcDate, 'Everton FC'),
    ]);
  });
});

import { extractScorers } from './merge';
import type { EspnDetail } from './types';

describe('extractScorers', () => {
  const detail: EspnDetail = {
    header: {
      competitions: [{
        status: { type: { state: 'post' } },
        details: [
          {
            scoringPlay: true, clock: { displayValue: "33'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }],
          },
          {
            scoringPlay: true, clock: { displayValue: "44'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Bryan Mbeumo' } }],
          },
          {
            scoringPlay: true, penaltyKick: true, clock: { displayValue: "48'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }],
          },
          {
            scoringPlay: false, type: { text: 'Red Card', abbreviation: 'RC' }, clock: { displayValue: "80'" },
            team: { id: '331' }, participants: [{ athlete: { displayName: 'Some Defender' } }],
          },
        ],
      }],
    },
  };

  it('groups goals by scorer and marks penalties', () => {
    const result = extractScorers(detail, '331'); // home team id = Brighton in this fixture
    expect(result.away).toEqual([
      { name: 'Patrick Dorgu', mins: ["33'"] },
      { name: 'Bryan Mbeumo', mins: ["44'"] },
      { name: 'Bruno Fernandes', mins: ["48' (P)"] },
    ]);
    expect(result.home).toEqual([]);
  });

  it('collects red cards separately from goals, attributed by team', () => {
    const result = extractScorers(detail, '331');
    expect(result.redCards.home).toEqual([{ name: 'Some Defender', min: "80'" }]);
    expect(result.redCards.away).toEqual([]);
  });
});
