import { describe, it, expect } from 'vitest';
import { buildFormationRows } from './formation';
import type { EspnRosterPlayer } from './types';

function player(name: string, abbrev: string, formationPlace: string, starter = true): EspnRosterPlayer {
  return { starter, formationPlace, position: { abbreviation: abbrev }, athlete: { displayName: name } };
}

describe('buildFormationRows', () => {
  it('groups a 4-2-3-1 XI into 5 rows of size 1,4,2,3,1', () => {
    const roster: EspnRosterPlayer[] = [
      player('Verbruggen', 'G', '1'),
      player('Van Hecke', 'CD-R', '5'), player('Milambo', 'CD-C', '4'), player('Igor', 'CD-L', '6'), player('Lamptey', 'RB', '2'),
      player('Ayari', 'DM', '8'), player('Baleba', 'DM', '9'),
      player('Wieffer', 'AM-R', '7'), player('Minteh', 'AM-C', '10'), player('Rutter', 'AM-L', '11'),
      player('Welbeck', 'F', '3'),
    ];
    const rows = buildFormationRows(roster, '4-2-3-1');
    expect(rows.map(r => r.length)).toEqual([1, 4, 2, 3, 1]);
    expect(rows[0][0].athlete?.displayName).toBe('Verbruggen');
  });

  it('excludes non-starters', () => {
    const roster: EspnRosterPlayer[] = [
      player('Verbruggen', 'G', '1'),
      player('Sub', 'F', '20', false),
    ];
    const rows = buildFormationRows(roster, '4-2-3-1');
    const names = rows.flat().map(p => p.athlete?.displayName);
    expect(names).not.toContain('Sub');
  });

  it('returns a single empty row for an empty/undefined roster instead of throwing', () => {
    expect(buildFormationRows(undefined, undefined)).toEqual([[]]);
    expect(buildFormationRows([], '4-3-3')).toEqual([[]]);
  });

  it('sorts a row using the -L/-R suffix on the abbreviation (right before left)', () => {
    const roster: EspnRosterPlayer[] = [
      player('GK', 'G', '1'),
      player('Left Back', 'LB', '3'), player('Right Back', 'RB', '2'), player('CB1', 'CD-R', '5'), player('CB2', 'CD-L', '6'),
    ];
    const rows = buildFormationRows(roster, '4');
    const backLine = rows[1].map(p => p.athlete?.displayName);
    expect(backLine.indexOf('Right Back')).toBeLessThan(backLine.indexOf('Left Back'));
  });
});
