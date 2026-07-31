import type { Metadata } from 'next';
import { getMatches } from '@/lib/matches';
import { fetchEspnDetail } from '@/lib/espn';
import { getCompetition } from '@/lib/competitions';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import { buildMetadata, SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/seo';
import type { EspnDetail } from '@/lib/types';
import MatchDetailClient from './MatchDetailClient';

function fallbackMetadata(id: string): Metadata {
  return buildMetadata({
    title: `Match Detail — ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    path: `/match/${id}`,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  // Mirrors app/api/match/[id]/route.ts's own lookup: the app's own match id is
  // resolved to an ESPN event id + competition slug server-side.
  const matchesResponse = await getMatches(process.env.FOOTBALL_API_KEY || '');
  const match = matchesResponse.matches.find(m => m.id === id);
  if (!match || !match.sources.espn) return fallbackMetadata(id);

  const slug = getCompetition(match.competition).espnSlug;
  // Same cache key as the route handler (app/api/match/[id]/route.ts) — populating it
  // here means MatchDetailClient's own fetch-on-mount hits a warm cache instead of
  // triggering a second live request for the same match.
  const cacheKey = `match-detail:${id}`;
  let detail = getCached<EspnDetail>(cacheKey);
  if (!detail) {
    detail = await fetchEspnDetail(slug, match.sources.espn);
    const state = detail.header?.competitions?.[0]?.status?.type?.state;
    setCached(cacheKey, detail, state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS);
  }

  const headerComp = detail.header?.competitions?.[0];
  const home = headerComp?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName;
  const away = headerComp?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName;
  if (!home || !away) return fallbackMetadata(id);

  return buildMetadata({
    title: `${home} vs ${away} — ${SITE_NAME}`,
    description: `Live score, lineups, stats and match events for ${home} vs ${away}.`,
    path: `/match/${id}`,
  });
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
