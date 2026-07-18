// NFD decomposition splits accented letters into base+combining-mark, so stripping the
// combining marks (U+0300–U+036F) removes accents without a manual character map —
// "München" → "Munchen". Ported from WC-2026-live-tracker/utils.js's normTeam.
export function normalizeTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const MU_TOKEN = 'manchesterunited';

// Both sources always spell the club's name out in full ("Manchester United FC" on
// football-data, "Manchester United" on ESPN) — verified live 2026-07-16 — so a simple
// substring check on the normalized name is enough; no abbreviation table needed.
export function isManUtd(name: string): boolean {
  return normalizeTeamName(name).includes(MU_TOKEN);
}

export function displayTeamName(name: string): string {
  return isManUtd(name) ? 'Red Devils' : name;
}
