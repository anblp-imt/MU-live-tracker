import { describe, it, expect } from 'vitest';
import { currentSeasonLabel } from './season';

describe('currentSeasonLabel', () => {
  it('is "2026-27" in the middle of that season (July 2026)', () => {
    expect(currentSeasonLabel(new Date('2026-07-16T00:00:00Z'))).toBe('2026-27');
  });

  it('is still "2025-26" in June, before the new season starts', () => {
    expect(currentSeasonLabel(new Date('2026-06-30T00:00:00Z'))).toBe('2025-26');
  });

  it('is "2025-26" in January (mid-season)', () => {
    expect(currentSeasonLabel(new Date('2026-01-05T00:00:00Z'))).toBe('2025-26');
  });

  it('flips to "2026-27" in December', () => {
    expect(currentSeasonLabel(new Date('2026-12-31T00:00:00Z'))).toBe('2026-27');
  });
});
