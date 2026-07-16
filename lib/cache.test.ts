import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, setCached, clearCache, matchesTtlMs, LIVE_TTL_MS, STATIC_TTL_MS } from './cache';

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
