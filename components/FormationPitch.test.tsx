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
