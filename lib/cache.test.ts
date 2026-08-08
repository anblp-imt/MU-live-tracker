import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCached, setCached, clearCache, matchesTtlMs, matchDetailTtlMs,
  LIVE_TTL_MS, STATIC_TTL_MS, NEAR_KICKOFF_TTL_MS,
} from './cache';

describe('in-memory cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    expect(getCached('nope')).toBeUndefined();
  });

  it('returns a stored value before it expires', () => {
    setCached('k', { a: 1 }, 1000);
    expect(getCached('k')).toEqual({ a: 1 });
  });

  it('returns undefined after the TTL elapses', () => {
    vi.useFakeTimers();
    setCached('k', 'v', 1000);
    vi.advanceTimersByTime(1001);
    expect(getCached('k')).toBeUndefined();
    vi.useRealTimers();
  });
});

describe('matchesTtlMs', () => {
  it('returns the live TTL when a match is IN_PLAY', () => {
    expect(matchesTtlMs([{ status: 'IN_PLAY' }])).toBe(LIVE_TTL_MS);
  });

  it('returns the live TTL when a match is PAUSED', () => {
    expect(matchesTtlMs([{ status: 'PAUSED' }])).toBe(LIVE_TTL_MS);
  });

  it('returns the static TTL when nothing is live', () => {
    expect(matchesTtlMs([{ status: 'SCHEDULED' }, { status: 'FINISHED' }])).toBe(STATIC_TTL_MS);
  });

  it('returns the static TTL for an empty list', () => {
    expect(matchesTtlMs([])).toBe(STATIC_TTL_MS);
  });
});

describe('matchDetailTtlMs', () => {
  const kickoff = '2026-08-08T15:00:00Z';

  it('returns the live TTL while the match is in play', () => {
    const now = new Date('2026-08-08T15:30:00Z').getTime();
    expect(matchDetailTtlMs('in', kickoff, now)).toBe(LIVE_TTL_MS);
  });

  it('returns the near-kickoff TTL when pre-match and within 60 minutes of kickoff', () => {
    const now = new Date('2026-08-08T14:30:00Z').getTime(); // 30 min before
    expect(matchDetailTtlMs('pre', kickoff, now)).toBe(NEAR_KICKOFF_TTL_MS);
  });

  it('returns the static TTL when pre-match and more than 60 minutes from kickoff', () => {
    const now = new Date('2026-08-08T12:00:00Z').getTime(); // 3 hours before
    expect(matchDetailTtlMs('pre', kickoff, now)).toBe(STATIC_TTL_MS);
  });

  it('returns the static TTL for a finished match even if just after kickoff', () => {
    const now = new Date('2026-08-08T15:05:00Z').getTime();
    expect(matchDetailTtlMs('post', kickoff, now)).toBe(STATIC_TTL_MS);
  });
});
