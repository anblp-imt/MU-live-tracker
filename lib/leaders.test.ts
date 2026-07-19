import { describe, it, expect } from 'vitest';
import { extractMatchContributions, tallyLeaders } from './leaders';
import type { EspnDetail } from './types';

const MU = '360';
const OPPONENT = '331';

function detail(overrides: Partial<EspnDetail> = {}): EspnDetail {
  return {
    header: { competitions: [{ status: { type: { state: 'post' } } }] },
    ...overrides,
  };
}

describe('extractMatchContributions', () => {
  it('extracts MU goals and their assists, ignoring the opponent\'s', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }, { athlete: { displayName: 'Amad Diallo' } }] },
            { scoringPlay: true, team: { id: OPPONENT }, participants: [{ athlete: { displayName: 'Opponent Striker' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual(['Bruno Fernandes']);
    expect(result.assists).toEqual(['Amad Diallo']);
  });

  it('does not credit an assist when a goal has no second participant (e.g. many penalties)', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, penaltyKick: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual(['Bruno Fernandes']);
    expect(result.assists).toEqual([]);
  });

  it('excludes own goals from both goals and assists, even when credited to MU\'s team id', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            // An opponent's own goal is scored BY the opponent but credited (team.id)
            // to MU, since MU benefits from it — must not appear as a MU player's goal.
            { scoringPlay: true, ownGoal: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Opponent Defender' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual([]);
    expect(result.assists).toEqual([]);
  });

  it('excludes shootout goals (they are not run-of-play goals)', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, shootout: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual([]);
  });

  it('extracts MU yellow cards from keyEvents, ignoring the opponent\'s and other event types', () => {
    const d = detail({
      keyEvents: [
        { type: { type: 'yellow-card' }, team: { id: MU }, participants: [{ athlete: { displayName: 'Casemiro' } }] },
        { type: { type: 'yellow-card' }, team: { id: OPPONENT }, participants: [{ athlete: { displayName: 'Opponent Midfielder' } }] },
        { type: { type: 'substitution' }, team: { id: MU }, participants: [{ athlete: { displayName: 'Amad Diallo' } }, { athlete: { displayName: 'Antony' } }] },
      ],
    });

    const result = extractMatchContributions(d, MU);
    expect(result.yellowCards).toEqual(['Casemiro']);
  });

  it('returns empty arrays for a match with no details or keyEvents at all', () => {
    const result = extractMatchContributions(detail(), MU);
    expect(result).toEqual({ goals: [], assists: [], yellowCards: [] });
  });
});

describe('tallyLeaders', () => {
  it('counts occurrences across matches and sorts descending', () => {
    const perMatch = [
      { goals: ['Bruno Fernandes', 'Amad Diallo'], assists: ['Antony'], yellowCards: [] },
      { goals: ['Bruno Fernandes'], assists: ['Antony'], yellowCards: ['Casemiro'] },
    ];

    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toEqual([
      { name: 'Bruno Fernandes', count: 2 },
      { name: 'Amad Diallo', count: 1 },
    ]);
    expect(result.topAssists).toEqual([{ name: 'Antony', count: 2 }]);
    expect(result.topYellowCards).toEqual([{ name: 'Casemiro', count: 1 }]);
  });

  it('breaks ties alphabetically by name', () => {
    const perMatch = [{ goals: ['Zidane', 'Amad'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toEqual([
      { name: 'Amad', count: 1 },
      { name: 'Zidane', count: 1 },
    ]);
  });

  it('caps each list at topN (default 5)', () => {
    const perMatch = [{ goals: ['A', 'B', 'C', 'D', 'E', 'F'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toHaveLength(5);
  });

  it('accepts a custom topN', () => {
    const perMatch = [{ goals: ['A', 'B', 'C'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch, 2);
    expect(result.topScorers).toHaveLength(2);
  });

  it('returns empty lists for no matches', () => {
    expect(tallyLeaders([])).toEqual({ topScorers: [], topAssists: [], topYellowCards: [] });
  });
});
