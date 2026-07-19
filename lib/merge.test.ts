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

  it('falls back to ESPN\'s score when FD reports FINISHED but hasn\'t published its own score yet', () => {
    // FD's status/score can lag its own faster-updating counterpart — this reproduces a
    // match ESPN already has final numbers for while FD's fullTime is still null:null.
    const finishedEspn = espnEvent({
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '999', displayName: 'Hull City' }, score: '1' },
          { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '3' },
        ],
        status: { type: { state: 'post' } },
      }],
    });
    const result = mergeMatches([fd()], { PL: [finishedEspn] });
    expect(result[0].status).toBe('FINISHED');
    expect(result[0].score.display).toEqual({ home: 1, away: 3 });
  });

  it('keeps FD\'s own score once it has one, even after ESPN enrichment', () => {
    const finishedEspn = espnEvent({
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '999', displayName: 'Hull City' }, score: '9' },
          { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '9' },
        ],
        status: { type: { state: 'post' } },
      }],
    });
    const fdWithScore = fd({ status: 'FINISHED', score: { duration: 'REGULAR', fullTime: { home: 1, away: 3 } } });
    const result = mergeMatches([fdWithScore], { PL: [finishedEspn] });
    expect(result[0].score.display).toEqual({ home: 1, away: 3 });
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

  it('reads a live ESPN-only match score, which the API sends as a plain numeric string', () => {
    const liveFriendly = espnEvent({
      id: 'f2',
      date: '2026-07-20T18:00:00Z',
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' }, score: '2' },
          { homeAway: 'away', team: { id: '111', displayName: 'Wrexham' }, score: '1' },
        ],
        status: { type: { state: 'in' }, displayClock: "60'" },
      }],
    });
    const result = mergeMatches([], { FRIENDLY: [liveFriendly] });
    expect(result[0].score.display).toEqual({ home: 2, away: 1 });
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

import { extractScorers, extractStats, extractSubstitutions, extractShootout } from './merge';
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

describe('extractSubstitutions', () => {
  it('splits substitution key events by team and sorts by minute', () => {
    const detail: EspnDetail = {
      header: { competitions: [{ status: { type: { state: 'post' } } }] },
      keyEvents: [
        {
          type: { type: 'substitution' }, clock: { displayValue: "70'", value: 4200 },
          team: { id: '360' }, participants: [{ athlete: { displayName: 'Amad Diallo' } }, { athlete: { displayName: 'Antony' } }],
        },
        {
          type: { type: 'substitution' }, clock: { displayValue: "45'", value: 2700 },
          team: { id: '331' }, participants: [{ athlete: { displayName: 'Yankuba Minteh' } }, { athlete: { displayName: 'Maxim De Cuyper' } }],
        },
        { type: { type: 'goal' }, clock: { displayValue: "10'" }, team: { id: '360' } },
      ],
    };
    const result = extractSubstitutions(detail, '331');
    expect(result.away).toEqual([{ min: "70'", playerIn: 'Amad Diallo', playerOut: 'Antony' }]);
    expect(result.home).toEqual([{ min: "45'", playerIn: 'Yankuba Minteh', playerOut: 'Maxim De Cuyper' }]);
  });

  it('returns empty arrays when there are no substitutions', () => {
    const detail: EspnDetail = { header: { competitions: [{ status: { type: { state: 'pre' } } }] } };
    expect(extractSubstitutions(detail, '331')).toEqual({ home: [], away: [] });
  });
});

describe('extractStats', () => {
  it('computes possession and pass accuracy, and passes through the plain counting stats', () => {
    const detail: EspnDetail = {
      header: { competitions: [{ status: { type: { state: 'post' } } }] },
      boxscore: {
        teams: [
          { homeAway: 'home', statistics: [
            { name: 'totalShots', displayValue: '13' }, { name: 'shotsOnTarget', displayValue: '2' },
            { name: 'possessionPct', displayValue: '52.4' }, { name: 'totalPasses', displayValue: '484' },
            { name: 'accuratePasses', displayValue: '415' }, { name: 'foulsCommitted', displayValue: '11' },
            { name: 'yellowCards', displayValue: '0' }, { name: 'redCards', displayValue: '0' },
            { name: 'offsides', displayValue: '1' }, { name: 'wonCorners', displayValue: '0' },
          ] },
          { homeAway: 'away', statistics: [
            { name: 'totalShots', displayValue: '11' }, { name: 'shotsOnTarget', displayValue: '7' },
            { name: 'possessionPct', displayValue: '47.6' }, { name: 'totalPasses', displayValue: '450' },
            { name: 'accuratePasses', displayValue: '372' }, { name: 'foulsCommitted', displayValue: '9' },
            { name: 'yellowCards', displayValue: '2' }, { name: 'redCards', displayValue: '0' },
            { name: 'offsides', displayValue: '3' }, { name: 'wonCorners', displayValue: '4' },
          ] },
        ],
      },
    };
    const result = extractStats(detail);
    expect(result.find(r => r.label === 'Shots')).toEqual({ label: 'Shots', home: { display: '13', value: 13 }, away: { display: '11', value: 11 } });
    expect(result.find(r => r.label === 'Possession')).toEqual({ label: 'Possession', home: { display: '52%', value: 52 }, away: { display: '48%', value: 48 } });
    expect(result.find(r => r.label === 'Pass Accuracy')).toEqual({ label: 'Pass Accuracy', home: { display: '86%', value: 86 }, away: { display: '83%', value: 83 } });
  });

  it('returns an empty list when boxscore stats are unavailable (e.g. a friendly)', () => {
    const detail: EspnDetail = { header: { competitions: [{ status: { type: { state: 'post' } } }] } };
    expect(extractStats(detail)).toEqual([]);
  });
});

describe('extractShootout', () => {
  it('pairs up rounds by index and reads each side\'s shootout score', () => {
    const detail: EspnDetail = {
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          competitors: [
            { homeAway: 'home', team: { id: '331' }, shootoutScore: '3' },
            { homeAway: 'away', team: { id: '360' }, shootoutScore: '4' },
          ],
        }],
      },
      shootout: [
        { id: '331', team: 'Brighton & Hove Albion', shots: [{ player: 'A', didScore: true }, { player: 'B', didScore: false }] },
        { id: '360', team: 'Manchester United', shots: [{ player: 'C', didScore: true }, { player: 'D', didScore: true }, { player: 'E', didScore: true }] },
      ],
    };
    const result = extractShootout(detail, '331');
    expect(result).not.toBeNull();
    expect(result!.homeScore).toBe('3');
    expect(result!.awayScore).toBe('4');
    expect(result!.rounds).toHaveLength(3);
    expect(result!.rounds[1]).toEqual({ home: { player: 'B', scored: false }, away: { player: 'D', scored: true } });
    expect(result!.rounds[2]).toEqual({ home: undefined, away: { player: 'E', scored: true } });
  });

  it('returns null when the match never went to a shootout', () => {
    const detail: EspnDetail = { header: { competitions: [{ status: { type: { state: 'post' } } }] } };
    expect(extractShootout(detail, '331')).toBeNull();
  });
});
