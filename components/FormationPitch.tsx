'use client';
import { useMemo } from 'react';
import { buildFormationRows } from '@/lib/formation';
import { displayTeamName, isManUtd } from '@/lib/normalize';
import type { EspnRoster } from '@/lib/types';
import styles from './FormationPitch.module.css';

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

  const homeIsMu = isManUtd(homeRoster?.team?.displayName || '');
  const awayIsMu = isManUtd(awayRoster?.team?.displayName || '');

  return (
    <div data-testid="formation-pitch" className={styles.pitch}>
      <div className={styles.pitchLines} />
      <div className={styles.teamLabel}>{displayTeamName(awayRoster?.team?.displayName || '')}</div>
      <div data-testid="away-rows">
        {awayRows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((p, j) => (
              <span key={j} className={styles.node}>
                <span className={`${styles.circle} ${awayIsMu ? styles.muCircle : ''}`}>{p.formationPlace}</span>
                <span className={styles.name}>{p.athlete?.displayName}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.midline}>
        <div className={styles.centerCircle} />
      </div>
      <div data-testid="home-rows">
        {homeRows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((p, j) => (
              <span key={j} className={styles.node}>
                <span className={`${styles.circle} ${homeIsMu ? styles.muCircle : ''}`}>{p.formationPlace}</span>
                <span className={styles.name}>{p.athlete?.displayName}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.teamLabel}>{displayTeamName(homeRoster?.team?.displayName || '')}</div>
    </div>
  );
}
