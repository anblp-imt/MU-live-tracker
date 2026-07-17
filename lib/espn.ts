import type { EspnDetail, EspnScheduleEvent } from './types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const MU_ESPN_ID = 360;

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

// Per-team schedule, not per-date scoreboard (unlike WC-2026-live-tracker) — HANDOFF.md
// section 2 chose this because it lets one call per league slug cover the whole season,
// and empty results dynamically tell us MU isn't (yet) in that competition. Verified live
// 2026-07-16: this endpoint has NO play-by-play `.details` — only fetchEspnDetail does.
export async function fetchEspnSchedule(slug: string): Promise<EspnScheduleEvent[]> {
  const data = (await espnFetch(`/${slug}/teams/${MU_ESPN_ID}/schedule`)) as { events?: EspnScheduleEvent[] };
  return data.events || [];
}

export async function fetchEspnDetail(slug: string, eventId: string): Promise<EspnDetail> {
  return (await espnFetch(`/${slug}/summary?event=${eventId}`)) as EspnDetail;
}
