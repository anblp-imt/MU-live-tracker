import type { Match } from './types';

export interface MonthGroup {
  key: string;
  label: string;
  matches: Match[];
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Schedule shows a full season at once (up to ~50 fixtures across every competition),
// which reads as an undifferentiated wall of rows — grouping by month gives the eye
// natural break points, the same way a real match programme's fixture list would.
export function groupMatchesByMonth(matches: Match[]): MonthGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = monthKey(new Date(m.utcDate));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(m);
    else buckets.set(key, [m]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ms]) => {
      const [year, month] = key.split('-').map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return { key, label, matches: ms.slice().sort((a, b) => a.utcDate.localeCompare(b.utcDate)) };
    });
}

// A month group whose matches all happened before the current month — used to
// default those groups to collapsed, so the page opens focused on what's coming up
// rather than scrolled past a season's worth of already-played fixtures.
export function isPastMonth(key: string, now: Date = new Date()): boolean {
  return key < monthKey(now);
}
