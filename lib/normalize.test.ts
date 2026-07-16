import { describe, it, expect } from 'vitest';
import { normalizeTeamName, isManUtd } from './normalize';

describe('normalizeTeamName', () => {
  it('lowercases and strips punctuation/spaces', () => {
    expect(normalizeTeamName('Nottingham Forest FC')).toBe('nottinghamforestfc');
  });

  it('strips accents via NFD decomposition', () => {
    expect(normalizeTeamName('Bayern München')).toBe('bayernmunchen');
  });

  it('handles empty/undefined input without throwing', () => {
    expect(normalizeTeamName('')).toBe('');
  });
});

describe('isManUtd', () => {
  it('matches football-data\'s "Manchester United FC"', () => {
    expect(isManUtd('Manchester United FC')).toBe(true);
  });

  it('matches ESPN\'s plain "Manchester United"', () => {
    expect(isManUtd('Manchester United')).toBe(true);
  });

  it('does not match Manchester City', () => {
    expect(isManUtd('Manchester City FC')).toBe(false);
  });
});
