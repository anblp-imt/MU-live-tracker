import { describe, it, expect } from 'vitest';
import { buildSquad } from './team';
import type { FdSquadPlayer, EspnTeamRoster } from './types';

function fdPlayer(overrides: Partial<FdSquadPlayer> = {}): FdSquadPlayer {
  return { name: 'Test Player', position: 'Midfield', dateOfBirth: '2000-01-01', nationality: 'England', ...overrides };
}

describe('buildSquad', () => {
  it('always returns exactly the four groups, in Goalkeepers/Defenders/Midfielders/Forwards order', () => {
    const groups = buildSquad([], { athletes: [] });
    expect(groups.map(g => g.label)).toEqual(['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']);
  });

  it('maps football-data position strings to the matching display group', () => {
    const fdSquad = [
      fdPlayer({ name: 'A', position: 'Goalkeeper' }),
      fdPlayer({ name: 'B', position: 'Defence' }),
      fdPlayer({ name: 'C', position: 'Midfield' }),
      fdPlayer({ name: 'D', position: 'Offence' }),
    ];
    const groups = buildSquad(fdSquad, { athletes: [] });
    expect(groups.find(g => g.label === 'Goalkeepers')!.players.map(p => p.name)).toEqual(['A']);
    expect(groups.find(g => g.label === 'Defenders')!.players.map(p => p.name)).toEqual(['B']);
    expect(groups.find(g => g.label === 'Midfielders')!.players.map(p => p.name)).toEqual(['C']);
    expect(groups.find(g => g.label === 'Forwards')!.players.map(p => p.name)).toEqual(['D']);
  });

  it('matches jersey numbers from the ESPN roster by normalized (diacritic-stripped) name', () => {
    const fdSquad = [fdPlayer({ name: 'Altay Bayındır', position: 'Goalkeeper' })];
    const espnRoster: EspnTeamRoster = { athletes: [{ displayName: 'Altay Bayindir', jersey: '1' }] };
    const groups = buildSquad(fdSquad, espnRoster);
    expect(groups.find(g => g.label === 'Goalkeepers')!.players).toEqual([{ name: 'Altay Bayındır', jersey: 1 }]);
  });

  it('keeps a football-data player with no ESPN match, with jersey: null instead of dropping them', () => {
    const fdSquad = [fdPlayer({ name: 'Andrey Santos', position: 'Midfield' })];
    const groups = buildSquad(fdSquad, { athletes: [] });
    expect(groups.find(g => g.label === 'Midfielders')!.players).toEqual([{ name: 'Andrey Santos', jersey: null }]);
  });

  it('sorts each group by jersey number ascending, with unnumbered players last by name', () => {
    const fdSquad = [
      fdPlayer({ name: 'Zed Unnumbered', position: 'Defence' }),
      fdPlayer({ name: 'High Number', position: 'Defence' }),
      fdPlayer({ name: 'Low Number', position: 'Defence' }),
      fdPlayer({ name: 'Amy Unnumbered', position: 'Defence' }),
    ];
    const espnRoster: EspnTeamRoster = {
      athletes: [
        { displayName: 'High Number', jersey: '30' },
        { displayName: 'Low Number', jersey: '2' },
      ],
    };
    const groups = buildSquad(fdSquad, espnRoster);
    expect(groups.find(g => g.label === 'Defenders')!.players.map(p => p.name)).toEqual([
      'Low Number', 'High Number', 'Amy Unnumbered', 'Zed Unnumbered',
    ]);
  });
});
