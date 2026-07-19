import type { EspnDetail, EspnScheduleEvent } from './types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
export const MU_ESPN_ID = 360;

async function espnFetch(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${ESPN_BASE}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (e) {
    throw new Error('ESPN network error: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  return res.json();
}

// Season boundary: European club season runs Aug→May, so July counts as the start of
// the *upcoming* season. Mirrors lib/season.ts's currentSeasonLabel heuristic.
function seasonDateRange(now: Date): string {
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() + 1 >= 7 ? year : year - 1;
  const ymd = (y: number, m: number, d: number) =>
    `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  return `${ymd(startYear, 7, 1)}-${ymd(startYear + 1, 6, 30)}`;
}

// Date-range scoreboard, not the per-team /schedule endpoint this used previously —
// verified live 2026-07-18: ESPN's per-team schedule aggregation is NOT populated for a
// new season until well after it starts (confirmed empty for eng.1/PL too, not just
// club.friendly), even though individual matches already exist and are discoverable via
// /scoreboard. club.friendly/eng.fa/eng.league_cup are MU's *only* source (football-data
// doesn't know about them), so an empty response there silently drops real fixtures —
// this bit a live match (MU vs Wrexham) during pre-season. The scoreboard endpoint
// defaults to a 100-event page, which truncates a full Premier League season (380
// matches) — `limit=500` covers the largest of our competitions with headroom, verified
// against real data. Scoreboard is league-wide (not team-scoped), so results are
// filtered down to MU's own fixtures client-side.
export async function fetchEspnSchedule(slug: string, now: Date = new Date()): Promise<EspnScheduleEvent[]> {
  const data = (await espnFetch(
    `/${slug}/scoreboard?dates=${seasonDateRange(now)}&limit=500`,
  )) as { events?: EspnScheduleEvent[] };
  const events = data.events || [];
  return events.filter(e =>
    e.competitions?.[0]?.competitors?.some(c => c.team?.id === String(MU_ESPN_ID)),
  );
}

export async function fetchEspnDetail(slug: string, eventId: string): Promise<EspnDetail> {
  return (await espnFetch(`/${slug}/summary?event=${eventId}`)) as EspnDetail;
}
