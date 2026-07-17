import type { EspnRosterPlayer } from './types';

// Maps traditional jersey-based formationPlace (1–11) to a lateral slot. Negative = right
// side of the pitch, positive = left, 0 = center. Matches classic numbering: #2=RB,
// #3=LB, #5=RCB, #6=LCB, #7=RW, #11=LW.
const FP_LAT: Record<number, number> = { 1: 0, 2: -2, 3: 2, 4: 0.5, 5: -1, 6: 1, 7: -2, 8: -0.5, 9: 0, 10: 0, 11: 2 };

// Determine which vertical line a player belongs to. ESPN suffixes side-specific
// abbreviations with -L/-R (e.g. CD-L, AM-R), so checks use startsWith/endsWith rather
// than exact match. formationPlace is used only as a last resort.
function playerLine(p: EspnRosterPlayer): number {
  const a = (p.position?.abbreviation || '').toUpperCase();
  const fp = Number(p.formationPlace);
  if (a === 'G' || a === 'GK') return 0;
  if (a.endsWith('B') || a.startsWith('CD') || a === 'D' || a === 'SW') return 1;
  if (a.includes('DM')) return 2;
  if (a === 'F' || a.endsWith('F')) return 5;
  if (a === 'LW' || a === 'RW') return 4;
  if (a.includes('AM')) return 4;
  if (a.includes('M')) return 3;
  if (fp === 7 || fp === 11) return 4;
  return 5;
}

// Horizontal slot within a line: leading R/L = wide (±2), trailing -R/-L = inner (±1).
function widthRank(a: string): number {
  if (/^R/.test(a)) return -2;
  if (/^L/.test(a)) return 2;
  if (/R$/.test(a)) return -1;
  if (/L$/.test(a)) return 1;
  return 0;
}

export function buildFormationRows(
  roster: EspnRosterPlayer[] | undefined,
  formation: string | undefined,
): EspnRosterPlayer[][] {
  const players = (roster || [])
    .filter(p => p.starter)
    .map(p => ({ p, line: playerLine(p), fp: Number(p.formationPlace) || 99 }))
    .sort((x, y) => x.line - y.line || x.fp - y.fp)
    .map(r => r.p);

  // Empty roster → return single empty row (no players to pitch)
  if (players.length === 0) {
    return [[]];
  }

  // The abbreviation's own -L/-R marker is authoritative when present; FP_LAT is a
  // fallback for side-less abbreviations (CM, F, AM…).
  const fpLat = (p: EspnRosterPlayer): number => {
    const w = widthRank((p.position?.abbreviation || '').toUpperCase());
    if (w !== 0) return w;
    const n = Number(p.formationPlace);
    return n in FP_LAT ? FP_LAT[n] : 0;
  };

  const rowCounts = (formation || '').split('-').map(Number).filter(n => n > 0);
  const rows: EspnRosterPlayer[][] = [players[0] ? [players[0]] : []];
  let i = 1;
  for (const count of rowCounts) {
    const slice = players.slice(i, i + count);
    slice.sort((a, b) => fpLat(a) - fpLat(b) || Number(a.formationPlace) - Number(b.formationPlace));
    rows.push(slice);
    i += count;
  }
  return rows;
}
