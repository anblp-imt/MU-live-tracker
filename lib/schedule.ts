import type { Match } from './types';

export interface MonthGroup {
  label: string;
  matches: Match[];
}

// Schedule shows a full season at once (up to ~50 fixtures across every competition),
// which reads as an undifferentiated wall of rows — grouping by month gives the eye
// natural break points, the same way a real match programme's fixture list would.
export function groupMatchesByMonth(matches: Match[]): MonthGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const d = new Date(m.utcDate);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(m);
    else buckets.set(key, [m]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ms]) => {
      const [year, month] = key.split('-').map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return { label, matches: ms.slice().sort((a, b) => a.utcDate.localeCompare(b.utcDate)) };
    });
}
