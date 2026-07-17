import { describe, it, expect } from 'vitest';
import { pollingIntervalForMatches, LIVE_POLL_MS, NEAR_KICKOFF_POLL_MS } from './polling';

const now = new Date('2026-08-22T11:00:00Z').getTime();

describe('pollingIntervalForMatches', () => {
  it('returns the live interval when a match is IN_PLAY', () => {
    expect(pollingIntervalForMatches([{ status: 'IN_PLAY', utcDate: '' }], now)).toBe(LIVE_POLL_MS);
  });

  it('returns the live interval when a match is PAUSED', () => {
    expect(pollingIntervalForMatches([{ status: 'PAUSED', utcDate: '' }], now)).toBe(LIVE_POLL_MS);
  });

  it('returns the near-kickoff interval when a SCHEDULED match starts within 30 minutes', () => {
    expect(pollingIntervalForMatches([{ status: 'SCHEDULED', utcDate: '2026-08-22T11:20:00Z' }], now)).toBe(NEAR_KICKOFF_POLL_MS);
  });

  it('returns null when nothing is live or imminent', () => {
    expect(pollingIntervalForMatches([{ status: 'FINISHED', utcDate: '2026-08-20T11:00:00Z' }], now)).toBeNull();
  });

  it('returns null for an empty match list', () => {
    expect(pollingIntervalForMatches([], now)).toBeNull();
  });
});
