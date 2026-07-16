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

function opponentFromFd(m: FdMatch): { name: string; venue: 'H' | 'A' } {
  return isManUtd(m.homeTeam.name)
    ? { name: m.awayTeam.name, venue: 'H' }
    : { name: m.homeTeam.name, venue: 'A' };
}

function opponentFromEspn(ev: EspnScheduleEvent): { name: string; venue: 'H' | 'A' } | null {
  const comp = ev.competitions[0];
  const mu = comp?.competitors.find(c => isManUtd(c.team.displayName));
  const opp = comp?.competitors.find(c => !isManUtd(c.team.displayName));
  if (!mu || !opp) return null;
  return { name: opp.team.displayName, venue: mu.homeAway === 'home' ? 'H' : 'A' };
}

function fdToMatch(m: FdMatch): Match | null {
  const competition = competitionIdForFdCode(m.competition.code);
  if (!competition) return null;
  const { name: opponentName, venue } = opponentFromFd(m);
  return {
    id: matchKey(m.utcDate, opponentName),
    utcDate: m.utcDate,
    status: m.status as Match['status'],
    competition,
    home: { name: m.homeTeam.name },
    away: { name: m.awayTeam.name },
    venue,
    score: { fullTime: { home: m.score.fullTime.home, away: m.score.fullTime.away }, display: computeDisplayScore(m.score) },
    sources: { fd: m.id },
  };
}

function espnStatusToMatchStatus(state: string, typeName?: string): Match['status'] {
  if (state === 'in') return typeName === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
  if (state === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

function espnToMatch(ev: EspnScheduleEvent, competition: CompetitionId): Match | null {
  const opponent = opponentFromEspn(ev);
  if (!opponent) return null;
  const comp = ev.competitions[0];
  const status = espnStatusToMatchStatus(comp.status.type.state, comp.status.type.name);
  const mu = comp.competitors.find(c => isManUtd(c.team.displayName))!;
  const opp = comp.competitors.find(c => !isManUtd(c.team.displayName))!;
  const home = mu.homeAway === 'home' ? mu : opp;
  const away = mu.homeAway === 'home' ? opp : mu;
  const score = status === 'SCHEDULED'
    ? { home: null, away: null }
    : { home: home.score?.value ?? null, away: away.score?.value ?? null };
  return {
    id: matchKey(ev.date, opponent.name),
    utcDate: ev.date,
    status,
    competition,
    home: { name: home.team.displayName },
    away: { name: away.team.displayName },
    venue: opponent.venue,
    score: { fullTime: score, display: score },
    minute: comp.status.displayClock,
    sources: { espn: ev.id },
  };
}

// FD is the backbone for PL/CL (status + score); ESPN enriches the same fixture with a
// faster-updating live status/minute (FD lags at kickoff and full-time — see
// WC-2026-live-tracker commit 38fe14b/d4670ba). Competitions FD doesn't cover at all
// (FA/EFL/friendly) come from ESPN alone. See design spec section 4.
export function mergeMatches(
  fdMatches: FdMatch[],
  espnEventsByCompetition: Partial<Record<CompetitionId, EspnScheduleEvent[]>>,
): Match[] {
  const fdConverted = fdMatches.map(fdToMatch).filter((m): m is Match => m !== null);
  // Joined by day only, not the full matchKey: football-data.org opponent names always carry
  // a club-suffix ("Hull City AFC") while ESPN's never do ("Hull City"), so normalizeTeamName
  // alone can't make the two sides' matchKeys agree. Day-only is safe because MU plays at most
  // one fixture per calendar day.
  const fdByDay = new Map(fdConverted.map(m => [dayKey(m.utcDate), m]));
  const espnOnly: Match[] = [];

  for (const { id: competition } of COMPETITIONS) {
    const events = espnEventsByCompetition[competition] || [];
    for (const ev of events) {
      const converted = espnToMatch(ev, competition);
      if (!converted) continue;
      const existing = fdByDay.get(dayKey(ev.date));
      if (existing) {
        existing.sources.espn = converted.sources.espn;
        if (converted.status === 'IN_PLAY' || converted.status === 'PAUSED' || converted.status === 'FINISHED') {
          existing.status = converted.status;
          existing.minute = converted.minute;
        }
        continue;
      }
      espnOnly.push(converted);
    }
  }

  return [...fdConverted, ...espnOnly].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}
