import type { FdSquadPlayer, EspnTeamRoster } from './types';
import { normalizeTeamName } from './normalize';

export type PositionGroupLabel = 'Goalkeepers' | 'Defenders' | 'Midfielders' | 'Forwards';

export interface TeamPlayer {
  name: string;
  jersey: number | null;
}

export interface TeamGroup {
  label: PositionGroupLabel;
  players: TeamPlayer[];
}

const GROUP_ORDER: PositionGroupLabel[] = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'];

// football-data.org's /teams/{id} squad uses exactly these four position strings —
// verified live 2026-07-21 against MU's own squad. 'Offence' is the only value that
// isn't Goalkeeper/Defence/Midfield, so it's the default case rather than an explicit one.
// Fallback only (see groupByNormalizedName below) — football-data's own position data
// can be stale (it has Patrick Dorgu, a left-back, tagged 'Offence', verified live
// 2026-07-21), so ESPN's roster position is preferred whenever it has the player.
function groupForFdPosition(position: string): PositionGroupLabel {
  switch (position) {
    case 'Goalkeeper': return 'Goalkeepers';
    case 'Defence': return 'Defenders';
    case 'Midfield': return 'Midfielders';
    default: return 'Forwards';
  }
}

const ESPN_POSITION_GROUP: Record<string, PositionGroupLabel> = {
  Goalkeeper: 'Goalkeepers',
  Defender: 'Defenders',
  Midfielder: 'Midfielders',
  Forward: 'Forwards',
};

function groupByNormalizedName(roster: EspnTeamRoster): Map<string, PositionGroupLabel> {
  const map = new Map<string, PositionGroupLabel>();
  for (const athlete of roster.athletes) {
    const label = athlete.position?.displayName ? ESPN_POSITION_GROUP[athlete.position.displayName] : undefined;
    if (label) map.set(normalizeTeamName(athlete.displayName), label);
  }
  return map;
}

// ESPN's roster is missing some current signings entirely and uses different
// diacritics than football-data (e.g. "Bayindir" vs "Bayındır") — normalizeTeamName's
// existing lowercase+NFD-strip+alphanumeric-only behavior (built for team-name
// matching) works identically well here, so it's reused rather than duplicated.
function jerseyByNormalizedName(roster: EspnTeamRoster): Map<string, number> {
  const map = new Map<string, number>();
  for (const athlete of roster.athletes) {
    const jersey = Number(athlete.jersey);
    if (!athlete.jersey || Number.isNaN(jersey)) continue;
    map.set(normalizeTeamName(athlete.displayName), jersey);
  }
  return map;
}

export function buildSquad(fdSquad: FdSquadPlayer[], espnRoster: EspnTeamRoster): TeamGroup[] {
  const jerseyByName = jerseyByNormalizedName(espnRoster);
  const groupByName = groupByNormalizedName(espnRoster);
  const groups = new Map<PositionGroupLabel, TeamPlayer[]>(GROUP_ORDER.map(label => [label, []]));

  for (const p of fdSquad) {
    const normalized = normalizeTeamName(p.name);
    const label = groupByName.get(normalized) ?? groupForFdPosition(p.position);
    const jersey = jerseyByName.get(normalized) ?? null;
    groups.get(label)!.push({ name: p.name, jersey });
  }

  for (const players of groups.values()) {
    players.sort((a, b) => {
      if (a.jersey === null && b.jersey === null) return a.name.localeCompare(b.name);
      if (a.jersey === null) return 1;
      if (b.jersey === null) return -1;
      return a.jersey - b.jersey;
    });
  }

  return GROUP_ORDER.map(label => ({ label, players: groups.get(label)! }));
}
