import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as formationLib from '@/lib/formation';
import { FormationPitch } from './FormationPitch';
import type { EspnRoster } from '@/lib/types';

const roster: EspnRoster = {
  homeAway: 'home',
  team: { displayName: 'Manchester United' },
  formation: '4-3-3',
  roster: [{ starter: true, formationPlace: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Onana' } }],
};

describe('FormationPitch', () => {
  it('shows a fallback message when no lineup is available (e.g. a friendly)', () => {
    render(<FormationPitch />);
    expect(screen.getByText(/lineup not available/i)).toBeInTheDocument();
  });

  it('renders the home roster player', () => {
    render(<FormationPitch homeRoster={roster} />);
    expect(screen.getByText('Onana')).toBeInTheDocument();
  });

  it('renders every player in a multi-player row, not just the first', () => {
    const multiPlayerRoster: EspnRoster = {
      homeAway: 'home',
      team: { displayName: 'Manchester United' },
      formation: '4-3-3',
      roster: [
        { starter: true, formationPlace: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Onana' } },
        { starter: true, formationPlace: '2', position: { abbreviation: 'RB' }, athlete: { displayName: 'Dalot' } },
        { starter: true, formationPlace: '3', position: { abbreviation: 'LB' }, athlete: { displayName: 'Shaw' } },
      ],
    };
    render(<FormationPitch homeRoster={multiPlayerRoster} />);
    expect(screen.getByText('Onana')).toBeInTheDocument();
    expect(screen.getByText('Dalot')).toBeInTheDocument();
    expect(screen.getByText('Shaw')).toBeInTheDocument();
  });

  it('shows each team\'s formation string, matching the row breakdown it actually renders', () => {
    const homeRd: EspnRoster = {
      homeAway: 'home',
      team: { displayName: 'Manchester United' },
      formation: '4-2-3-1',
      roster: [
        { starter: true, formationPlace: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Onana' } },
        { starter: true, formationPlace: '2', position: { abbreviation: 'RB' }, athlete: { displayName: 'Dalot' } },
        { starter: true, formationPlace: '5', position: { abbreviation: 'RCB' }, athlete: { displayName: 'Martinez' } },
        { starter: true, formationPlace: '6', position: { abbreviation: 'LCB' }, athlete: { displayName: 'Maguire' } },
        { starter: true, formationPlace: '3', position: { abbreviation: 'LB' }, athlete: { displayName: 'Shaw' } },
        { starter: true, formationPlace: '8', position: { abbreviation: 'DM' }, athlete: { displayName: 'Mainoo' } },
        { starter: true, formationPlace: '4', position: { abbreviation: 'DM' }, athlete: { displayName: 'Casemiro' } },
        { starter: true, formationPlace: '7', position: { abbreviation: 'RW' }, athlete: { displayName: 'Antony' } },
        { starter: true, formationPlace: '10', position: { abbreviation: 'AM' }, athlete: { displayName: 'Bruno' } },
        { starter: true, formationPlace: '11', position: { abbreviation: 'LW' }, athlete: { displayName: 'Rashford' } },
        { starter: true, formationPlace: '9', position: { abbreviation: 'F' }, athlete: { displayName: 'Hojlund' } },
      ],
    };
    render(<FormationPitch homeRoster={homeRd} />);
    expect(screen.getByText('4-2-3-1')).toBeInTheDocument();
    const rows = screen.getByTestId('home-rows').querySelectorAll('[class*="row"]');
    expect(Array.from(rows).map(r => r.children.length)).toEqual([1, 3, 2, 4, 1]); // mirrored: FWD,AM,DM,DEF,GK
  });

  it('shows "Red Devils" as the team label wherever MU is playing — home or away', () => {
    const awayMuRoster: EspnRoster = { homeAway: 'away', team: { displayName: 'Manchester United' }, formation: '4-3-3', roster: [] };
    const homeOpponentRoster: EspnRoster = { homeAway: 'home', team: { displayName: 'Brighton & Hove Albion' }, formation: '4-3-3', roster: [] };
    render(<FormationPitch homeRoster={homeOpponentRoster} awayRoster={awayMuRoster} />);
    expect(screen.getByText('Red Devils')).toBeInTheDocument();
    expect(screen.getByText('Brighton & Hove Albion')).toBeInTheDocument();
  });

  it('memoizes buildFormationRows: re-rendering with the same roster reference does not recompute it', () => {
    const spy = vi.spyOn(formationLib, 'buildFormationRows');
    const { rerender } = render(<FormationPitch homeRoster={roster} />);
    const callsAfterFirstRender = spy.mock.calls.length;

    rerender(<FormationPitch homeRoster={roster} />); // same object reference
    expect(spy.mock.calls.length).toBe(callsAfterFirstRender);

    const changedRoster = { ...roster, formation: '4-4-2' };
    rerender(<FormationPitch homeRoster={changedRoster} />); // new reference
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirstRender);

    spy.mockRestore();
  });
});
