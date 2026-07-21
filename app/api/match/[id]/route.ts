import { NextRequest, NextResponse } from 'next/server';
import { fetchEspnDetail } from '@/lib/espn';
import { getMatches } from '@/lib/matches';
import { getCompetition } from '@/lib/competitions';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import type { EspnDetail } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // The app's own match id (e.g. "2026-07-18_wrexham") is the only thing the browser
  // ever sees — the ESPN event id and competition slug it maps to are resolved here,
  // server-side, instead of being passed in as query params.
  const matchesResponse = await getMatches(process.env.FOOTBALL_API_KEY || '');
  const match = matchesResponse.matches.find(m => m.id === id);
  if (!match || !match.sources.espn) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }
  const espnId = match.sources.espn;
  const slug = getCompetition(match.competition).espnSlug;

  const cacheKey = `match-detail:${id}`;
  const cached = getCached<EspnDetail>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const detail = await fetchEspnDetail(slug, espnId);
  const state = detail.header?.competitions?.[0]?.status?.type?.state;
  setCached(cacheKey, detail, state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS);
  return NextResponse.json(detail);
}
