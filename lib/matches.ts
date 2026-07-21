import { fetchMuMatches } from './fd';
import { fetchEspnSchedule } from './espn';
import { mergeMatches } from './merge';
import { getCached, setCached, matchesTtlMs } from './cache';
import { currentSeasonLabel } from './season';
import { COMPETITIONS } from './competitions';
import type { CompetitionId, EspnScheduleEvent, FdMatch, MatchesResponse } from './types';

const CACHE_KEY = 'matches';

export async function getMatches(apiKey: string): Promise<MatchesResponse> {
  const cached = getCached<MatchesResponse>(CACHE_KEY);
  if (cached) return cached;

  // Promise.allSettled means one dead source degrades the response instead of failing
  // it outright — spec section 8's error-handling requirement.
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
  const response: MatchesResponse = {
    season: currentSeasonLabel(),
    matches,
    meta: {
      sources: {
        fd: fdResult.status === 'fulfilled',
        espn: espnResults.some(r => r.status === 'fulfilled'),
      },
    },
  };

  setCached(CACHE_KEY, response, matchesTtlMs(matches));
  return response;
}
