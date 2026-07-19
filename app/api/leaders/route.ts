import { NextResponse } from 'next/server';
import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule, fetchEspnDetail, MU_ESPN_ID } from '@/lib/espn';
import { mergeMatches } from '@/lib/merge';
import { extractMatchContributions, tallyLeaders } from '@/lib/leaders';
import { getCached, setCached, LEADERS_TTL_MS } from '@/lib/cache';
import { COMPETITIONS, getCompetition } from '@/lib/competitions';
import type { CompetitionId, EspnScheduleEvent, FdMatch, SeasonLeaders } from '@/lib/types';

const CACHE_KEY = 'leaders';

export async function GET() {
  const cached = getCached<SeasonLeaders>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.FOOTBALL_API_KEY || '';

  // Same fetch-and-merge as /api/matches (lib/fd + lib/espn + mergeMatches) — this route
  // needs its own independently-fetched match list (to reach `sources.espn`/`competition`
  // per fixture) rather than reading the 'matches' cache key, so it stays correct even
  // when this route is hit before /api/matches has ever populated that cache.
  const [fdResult, ...espnResults] = await Promise.allSettled([
    fetchMuMatches(apiKey),
    ...COMPETITIONS.map(c => fetchEspnSchedule(c.espnSlug)),
  ]);
  const fdMatches: FdMatch[] = fdResult.status === 'fulfilled' ? fdResult.value : [];
  const espnEventsByCompetition: Partial<Record<CompetitionId, EspnScheduleEvent[]>> = {};
  COMPETITIONS.forEach((c, i) => {
    const result = espnResults[i];
    espnEventsByCompetition[c.id] = result.status === 'fulfilled' ? result.value : [];
  });
  const matches = mergeMatches(fdMatches, espnEventsByCompetition);

  // Season leaders is a competitive-record view — Friendlies excluded, same as the
  // Stats page's W-D-L tiles. Only matches with an ESPN event id can have their
  // per-player detail fetched at all.
  const finishedMatches = matches.filter(
    m => m.status === 'FINISHED' && m.competition !== 'FRIENDLY' && m.sources.espn,
  );

  const detailResults = await Promise.allSettled(
    finishedMatches.map(m => fetchEspnDetail(getCompetition(m.competition).espnSlug, m.sources.espn!)),
  );

  const perMatch = detailResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchEspnDetail>>> => r.status === 'fulfilled')
    .map(r => extractMatchContributions(r.value, String(MU_ESPN_ID)));

  const leaders = tallyLeaders(perMatch);
  setCached(CACHE_KEY, leaders, LEADERS_TTL_MS);
  return NextResponse.json(leaders);
}
