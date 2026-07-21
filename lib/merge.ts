// lib/merge.ts
import type { CompetitionId, EspnDetail, EspnScheduleEvent, EspnScoringDetail, FdMatch, Match, MatchStatRow, Scorers, ShootoutSummary, Substitution } from './types';
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
  // ESPN's scoreboard/schedule endpoint returns competitor.score as a plain numeric
  // string (e.g. "2"), not the { value } object the FD wire type might suggest —
  // reading `.value` off a string silently returns undefined, which is why ESPN-only
  // fixtures (friendlies, cups) never showed a live score.
  const toScore = (s?: string): number | null => (s === undefined ? null : Number(s));
  const score = status === 'SCHEDULED'
    ? { home: null, away: null }
    : { home: toScore(home.score), away: toScore(away.score) };
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
          // FD's own score can lag behind its own status (see comment above this
          // function) — if ESPN already reports this match live/finished but FD hasn't
          // published a score yet, use ESPN's (now correctly parsed, see
          // espnToMatch) score instead of leaving the card showing "-  :  -".
          if (existing.score.display.home === null || existing.score.display.away === null) {
            existing.score = converted.score;
          }
        }
        continue;
      }
      espnOnly.push(converted);
    }
  }

  return [...fdConverted, ...espnOnly].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

function groupByScorer(entries: EspnScoringDetail[]): Array<{ name: string; mins: string[] }> {
  const order: string[] = [];
  const byName: Record<string, string[]> = {};
  entries.forEach(g => {
    const name = g.participants?.[0]?.athlete?.displayName || '?';
    const mark = g.penaltyKick ? ' (P)' : g.ownGoal ? ' (OG)' : '';
    const min = (g.clock?.displayValue || '') + mark;
    if (!byName[name]) { byName[name] = []; order.push(name); }
    byName[name].push(min);
  });
  return order.map(name => ({ name, mins: byName[name] }));
}

// Reads the /summary detail response (Task 11's fetchEspnDetail), NOT the schedule
// event — the team-schedule endpoint has no play-by-play `.details` at all (verified
// live 2026-07-16). homeTeamEspnId comes from
// detail.header.competitions[0].competitors.find(c => c.homeAway === 'home').team.id.
export function extractScorers(detail: EspnDetail, homeTeamEspnId: string): Scorers {
  const details = detail.header.competitions[0]?.details || [];
  const goals = details.filter(d => d.scoringPlay && !d.shootout);
  const home = groupByScorer(goals.filter(g => g.team?.id === homeTeamEspnId));
  const away = groupByScorer(goals.filter(g => g.team?.id !== homeTeamEspnId));

  const isRedCard = (d: EspnScoringDetail) =>
    !d.scoringPlay && (
      d.type?.text?.toLowerCase().includes('red card') ||
      d.type?.abbreviation?.toUpperCase() === 'RC'
    );
  const cards = details.filter(isRedCard);
  const redCards = {
    home: cards.filter(d => d.team?.id === homeTeamEspnId)
      .map(d => ({ name: d.participants?.[0]?.athlete?.displayName || '?', min: d.clock?.displayValue || '' })),
    away: cards.filter(d => d.team?.id !== homeTeamEspnId)
      .map(d => ({ name: d.participants?.[0]?.athlete?.displayName || '?', min: d.clock?.displayValue || '' })),
  };

  return { home, away, redCards };
}

// keyEvents (unlike header.competitions[0].details) is only present on the /summary
// detail response, same as extractScorers above. Ported from
// WC-2026-live-tracker/render.js's subEvts: participants[0] is the player coming on,
// participants[1] is the player going off — ESPN doesn't label them, that positional
// order is the only signal.
export function extractSubstitutions(detail: EspnDetail, homeTeamEspnId: string): { home: Substitution[]; away: Substitution[] } {
  const subs = (detail.keyEvents || [])
    .filter(e => e.type?.type === 'substitution')
    .map(e => ({
      min: e.clock?.displayValue || '',
      minVal: e.clock?.value ?? 0,
      teamId: e.team?.id,
      playerIn: e.participants?.[0]?.athlete?.displayName || '?',
      playerOut: e.participants?.[1]?.athlete?.displayName || '?',
    }))
    .sort((a, b) => a.minVal - b.minVal);
  const toSub = ({ min, playerIn, playerOut }: typeof subs[number]): Substitution => ({ min, playerIn, playerOut });
  return {
    home: subs.filter(s => s.teamId === homeTeamEspnId).map(toSub),
    away: subs.filter(s => s.teamId !== homeTeamEspnId).map(toSub),
  };
}

// Ported from WC-2026-live-tracker/render.js's STAT_DEFS, in the same display order.
// possessionPct and pass accuracy aren't plain passthrough fields — ESPN reports raw
// possessionPct without a '%' suffix, and doesn't report pass accuracy at all (it has to
// be computed from accuratePasses/totalPasses).
const PLAIN_STAT_DEFS: Array<{ label: string; name: string }> = [
  { label: 'Fouls', name: 'foulsCommitted' },
  { label: 'Yellow Cards', name: 'yellowCards' },
  { label: 'Red Cards', name: 'redCards' },
  { label: 'Offsides', name: 'offsides' },
  { label: 'Corners', name: 'wonCorners' },
];

export function extractStats(detail: EspnDetail): MatchStatRow[] {
  const teams = detail.boxscore?.teams || [];
  const home = teams.find(t => t.homeAway === 'home');
  const away = teams.find(t => t.homeAway === 'away');
  if (!home?.statistics?.length || !away?.statistics?.length) return [];

  const raw = (team: typeof home, name: string) => team?.statistics?.find(s => s.name === name)?.displayValue;
  const num = (v: string | undefined) => { const n = parseFloat(v || ''); return Number.isFinite(n) ? n : 0; };
  const plainRow = (label: string, name: string): MatchStatRow => {
    const h = raw(home, name);
    const a = raw(away, name);
    return { label, home: { display: h ?? '–', value: num(h) }, away: { display: a ?? '–', value: num(a) } };
  };
  // homeVal/awayVal are `null` when there's no underlying data for that side — displayed
  // as '–' rather than a misleading '0%'. `value` stays 0 in that case so the stat-bar
  // width calc in page.tsx (which divides by home.value + away.value) is unaffected.
  const percentRow = (label: string, homeVal: number | null, awayVal: number | null): MatchStatRow => ({
    label,
    home: { display: homeVal === null ? '–' : `${homeVal}%`, value: homeVal ?? 0 },
    away: { display: awayVal === null ? '–' : `${awayVal}%`, value: awayVal ?? 0 },
  });
  // Home and away possession always sum to 100% in the raw data (same 90 minutes split
  // two ways) — round home only and derive away from it, so independent per-side
  // rounding (e.g. 49.5/50.5 -> 50%/51%) can never break that invariant.
  const possessionRow = (): MatchStatRow => {
    const h = raw(home, 'possessionPct');
    const a = raw(away, 'possessionPct');
    if (h == null && a == null) return percentRow('Possession', null, null);
    const homePct = Math.round(num(h));
    return percentRow('Possession', homePct, 100 - homePct);
  };
  // Unlike possession, each team's pass accuracy is independent (both can legitimately
  // be at 85%) — rounded separately, never derived from the other side.
  const passAccuracy = (team: typeof home): number | null => {
    const total = num(raw(team, 'totalPasses'));
    return total ? Math.round(num(raw(team, 'accuratePasses')) / total * 100) : null;
  };

  return [
    plainRow('Shots', 'totalShots'),
    plainRow('Shots on Target', 'shotsOnTarget'),
    possessionRow(),
    plainRow('Passes', 'totalPasses'),
    percentRow('Pass Accuracy', passAccuracy(home), passAccuracy(away)),
    ...PLAIN_STAT_DEFS.map(({ label, name }) => plainRow(label, name)),
  ];
}

// Ported from WC-2026-live-tracker/render.js's renderShootout. `shootout[].id` is the
// team id (matched against homeTeamEspnId the same way extractScorers/extractSubstitutions
// are), not to be confused with `shootout[].team`, which is the display name.
export function extractShootout(detail: EspnDetail, homeTeamEspnId: string): ShootoutSummary | null {
  const shootout = detail.shootout;
  if (!shootout?.length) return null;

  const headerCompetitors = detail.header.competitions[0]?.competitors || [];
  const homeC = headerCompetitors.find(c => c.homeAway === 'home');
  const awayC = headerCompetitors.find(c => c.homeAway === 'away');
  const homeTeam = shootout.find(s => s.id === homeTeamEspnId);
  const awayTeam = shootout.find(s => s.id !== homeTeamEspnId);
  if (!homeTeam || !awayTeam) return null;

  const maxRounds = Math.max(homeTeam.shots?.length || 0, awayTeam.shots?.length || 0);
  const rounds: ShootoutSummary['rounds'] = [];
  for (let i = 0; i < maxRounds; i++) {
    const h = homeTeam.shots?.[i];
    const a = awayTeam.shots?.[i];
    rounds.push({
      home: h ? { player: h.player, scored: h.didScore } : undefined,
      away: a ? { player: a.player, scored: a.didScore } : undefined,
    });
  }

  return {
    homeTeam: homeTeam.team || '',
    awayTeam: awayTeam.team || '',
    homeScore: homeC?.shootoutScore ?? '',
    awayScore: awayC?.shootoutScore ?? '',
    rounds,
  };
}
