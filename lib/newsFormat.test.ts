import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo } from './newsFormat';

const NOW = new Date('2026-08-03T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timeAgo', () => {
  it('returns "just now" for less than a minute ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 30 * 1000).toISOString())).toBe('just now');
  });

  it('floors 90 minutes to "1h ago", not "2h ago"', () => {
    expect(timeAgo(new Date(NOW.getTime() - 90 * 60 * 1000).toISOString())).toBe('1h ago');
  });

  it('floors 36 hours to "1d ago", not "2d ago"', () => {
    expect(timeAgo(new Date(NOW.getTime() - 36 * 60 * 60 * 1000).toISOString())).toBe('1d ago');
  });
});
