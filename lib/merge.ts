// lib/merge.ts
import type { CompetitionId, EspnScheduleEvent, EspnScoringDetail, FdMatch, Match, Scorers } from './types';
import { normalizeTeamName, isManUtd } from './normalize';
import { COMPETITIONS, competitionIdForFdCode } from './competitions';

function dayKey(iso: string): string {
  return (iso || '').slice(0, 10);
}

export function matchKey(utcDate: string, opponentName: string): string {
  return `${dayKey(utcDate)}_${normalizeTeamName(opponentName)}`;
}

// football-data's `fullTime` includes shootout goals when duration is PENALTY_SHOOTOUT
// (fullTime = regularTime + penalties), so it can't be used as the pre-penalty score.
// regularTime + extraTime gives the true score to display. Ported from
// WC-2026-live-tracker/utils.js's preShootoutScore (bug fixed there in commit d4670ba).
export function computeDisplayScore(score: FdMatch['score']): { home: number | null; away: number | null } {
  if (score.duration === 'PENALTY_SHOOTOUT' && score.regularTime) {
    return {
      home: (score.regularTime.home ?? 0) + (score.extraTime?.home ?? 0),
      away: (score.regularTime.away ?? 0) + (score.extraTime?.away ?? 0),
    };
  }
  return { home: score.fullTime.home, away: score.fullTime.away };
}
