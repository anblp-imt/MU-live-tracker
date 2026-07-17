'use client';
import { useMemo } from 'react';
import { buildFormationRows } from '@/lib/formation';
import type { EspnRoster } from '@/lib/types';

export function FormationPitch({ homeRoster, awayRoster }: { homeRoster?: EspnRoster; awayRoster?: EspnRoster }) {
  // [React] buildFormationRows re-sorts and re-groups every starter on every call. It's
  // cheap for 11 players, but this page re-renders every 30s from usePolling while a
  // match is live — useMemo means it only re-runs when the roster/formation actually
  // change, not on every unrelated re-render (e.g. the live minute ticking elsewhere).
  const homeRows = useMemo(
    () => buildFormationRows(homeRoster?.roster, homeRoster?.formation),
    [homeRoster],
  );
  const awayRows = useMemo(
    () => buildFormationRows(awayRoster?.roster, awayRoster?.formation),
    [awayRoster],
  );

  if (!homeRoster && !awayRoster) {
    return <p>Lineup not available for this match.</p>;
  }

  return (
    <div data-testid="formation-pitch">
      <div data-testid="away-rows">
        {awayRows.map((row, i) => (
          <div key={i}>{row.map(p => p.athlete?.displayName).join(', ')}</div>
        ))}
      </div>
      <div data-testid="home-rows">
        {homeRows.map((row, i) => (
          <div key={i}>{row.map(p => p.athlete?.displayName).join(', ')}</div>
        ))}
      </div>
    </div>
  );
}
