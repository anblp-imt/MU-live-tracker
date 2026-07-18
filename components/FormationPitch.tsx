'use client';
import { useMemo } from 'react';
import { buildFormationRows } from '@/lib/formation';
import { displayTeamName, isManUtd } from '@/lib/normalize';
import type { EspnRoster, EspnRosterPlayer } from '@/lib/types';
import styles from './FormationPitch.module.css';

// Prefer ESPN's own short form (surname only, e.g. "B. Fernandes"); fall back to the
// last word of the full name so an unexpected shape still renders something short.
function playerLabel(p: EspnRosterPlayer): string {
  if (p.athlete?.shortName) return p.athlete.shortName;
  const parts = (p.athlete?.displayName || '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '';
}

// Dark-mode kit renders white lines on a transparent background, which suits the green
// pitch backdrop better than the default light-mode jersey image.
function jerseyKitUrl(p: EspnRosterPlayer): string | undefined {
  const images = p.athlete?.jerseyImages || [];
  return images.find(img => img.rel?.includes('dark'))?.href || images[0]?.href;
}

// ESPN only exposes each club's default kit render, not the specific strip actually worn
// that match — two clubs whose default colors happen to be similar (e.g. Man Utd and
// Wrexham, both red) then render as visually identical shirts. Rather than trust that
// coincidence, the away side always gets a fixed gold ring instead of its real team
// color, so the two sides stay tellable apart regardless of how close their colors are.
function PlayerNode({ player, isMu, side, teamColor }: { player: EspnRosterPlayer; isMu: boolean; side: 'home' | 'away'; teamColor?: string }) {
  const kitUrl = jerseyKitUrl(player);
  const ringColor = side === 'away' ? 'var(--mu-gold-bright)' : teamColor;
  return (
    <span className={styles.node}>
      {kitUrl ? (
        <span className={styles.kitCircle} style={{ borderColor: ringColor }}>
          <img className={styles.kitImage} src={kitUrl} alt={player.jersey || ''} loading="lazy" />
        </span>
      ) : (
        <span className={`${styles.circle} ${isMu ? styles.muCircle : ''}`}>{player.jersey || player.formationPlace}</span>
      )}
      <span className={styles.name}>{playerLabel(player)}</span>
    </span>
  );
}

export function FormationPitch({ homeRoster, awayRoster }: { homeRoster?: EspnRoster; awayRoster?: EspnRoster }) {
  // [React] buildFormationRows re-sorts and re-groups every starter on every call. It's
  // cheap for 11 players, but this page re-renders every 30s from usePolling while a
  // match is live — useMemo means it only re-runs when the roster/formation actually
  // change, not on every unrelated re-render (e.g. the live minute ticking elsewhere).
  // Home sits below the midline defending the bottom goal, so its rows (and each row's
  // own left-right order) must mirror the away half — GK nearest the bottom edge,
  // attackers nearest the midline — otherwise the keeper renders as if it were a striker.
  const homeRows = useMemo(
    () => buildFormationRows(homeRoster?.roster, homeRoster?.formation)
      .map(row => [...row].reverse())
      .reverse(),
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
  const homeColor = homeRoster?.team?.color ? `#${homeRoster.team.color}` : undefined;
  const awayColor = awayRoster?.team?.color ? `#${awayRoster.team.color}` : undefined;

  return (
    <div data-testid="formation-pitch" className={styles.pitch}>
      <div className={styles.pitchLines} />
      <div className={styles.teamLabel}>{displayTeamName(awayRoster?.team?.displayName || '')}</div>
      <div data-testid="away-rows">
        {awayRows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((p, j) => (
              <PlayerNode key={j} player={p} isMu={awayIsMu} side="away" teamColor={awayColor} />
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
              <PlayerNode key={j} player={p} isMu={homeIsMu} side="home" teamColor={homeColor} />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.teamLabel}>{displayTeamName(homeRoster?.team?.displayName || '')}</div>
    </div>
  );
}
