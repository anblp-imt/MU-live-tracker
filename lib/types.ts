// lib/types.ts

export type CompetitionId = 'PL' | 'CL' | 'FA' | 'EFL' | 'FRIENDLY';

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED';

export interface Team {
  name: string;
  crest?: string;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface MatchScore {
  fullTime: Score;
  display: Score;
}

export interface Match {
  id: string;
  utcDate: string;
  status: MatchStatus;
  competition: CompetitionId;
  home: Team;
  away: Team;
  venue: 'H' | 'A';
  score: MatchScore;
  minute?: string;
  sources: { fd?: number; espn?: string };
}

export interface StandingRow {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
}

export interface MatchesResponse {
  season: string;
  matches: Match[];
  meta: { sources: { fd: boolean; espn: boolean } };
}

export interface Scorers {
  home: Array<{ name: string; mins: string[] }>;
  away: Array<{ name: string; mins: string[] }>;
  redCards: {
    home: Array<{ name: string; min: string }>;
    away: Array<{ name: string; min: string }>;
  };
}

// --- football-data.org v4 wire types (subset actually used; verified live 2026-07-16) ---

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { code: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    duration: string;
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
    extraTime?: { home: number | null; away: number | null };
  };
}

export interface FdStandingRow {
  position: number;
  team: { name: string; crest?: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
}

// --- ESPN site-api wire types (subset actually used; verified live 2026-07-16) ---

export interface EspnScheduleEvent {
  id: string;
  date: string;
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away';
      team: { id: string; displayName: string };
      score?: { value: number };
    }>;
    status: { type: { state: 'pre' | 'in' | 'post'; name?: string }; displayClock?: string };
  }>;
}

export interface EspnScoringDetail {
  scoringPlay?: boolean;
  ownGoal?: boolean;
  penaltyKick?: boolean;
  shootout?: boolean;
  type?: { text?: string; abbreviation?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  participants?: Array<{ athlete?: { displayName?: string } }>;
}

export interface EspnRosterPlayer {
  starter: boolean;
  formationPlace?: string;
  position?: { abbreviation?: string };
  athlete?: { displayName?: string };
}

export interface EspnRoster {
  homeAway: 'home' | 'away';
  team?: { displayName?: string };
  formation?: string;
  roster: EspnRosterPlayer[];
}

export interface EspnDetail {
  header: {
    competitions: Array<{
      status: { type: { state: 'pre' | 'in' | 'post'; name?: string }; displayClock?: string };
      details?: EspnScoringDetail[];
      competitors?: Array<{ homeAway: 'home' | 'away'; team?: { id?: string } }>;
    }>;
  };
  rosters?: EspnRoster[];
}
