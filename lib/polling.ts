import type { Match } from './types';

export const LIVE_POLL_MS = 30_000;
export const NEAR_KICKOFF_POLL_MS = 5 * 60_000;
const NEAR_KICKOFF_WINDOW_MS = 30 * 60_000;

export function pollingIntervalForMatches(
  matches: Array<Pick<Match, 'status' | 'utcDate'>>,
  now: number = Date.now(),
): number | null {
  if (matches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return LIVE_POLL_MS;

  const nearKickoff = matches.some(m => {
    if (m.status !== 'SCHEDULED' && m.status !== 'TIMED') return false;
    const t = new Date(m.utcDate).getTime();
    return !Number.isNaN(t) && Math.abs(t - now) < NEAR_KICKOFF_WINDOW_MS;
  });
  return nearKickoff ? NEAR_KICKOFF_POLL_MS : null;
}
