import { describe, it, expect } from 'vitest';
import { normalizeTeamName, isManUtd, displayTeamName, displayTeamAbbr } from './normalize';

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

  it('converts Turkish dotless ı to plain i (NFD does not decompose it)', () => {
    expect(normalizeTeamName('Altay Bayındır')).toBe('altaybayindir');
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

describe('displayTeamName', () => {
  it('returns "Red Devils" for Manchester United, from either data source', () => {
    expect(displayTeamName('Manchester United FC')).toBe('Red Devils');
    expect(displayTeamName('Manchester United')).toBe('Red Devils');
  });

  it('returns the name unchanged for any other club', () => {
    expect(displayTeamName('Arsenal FC')).toBe('Arsenal FC');
  });
});

describe('displayTeamAbbr', () => {
  it('returns "Red Devils" for Manchester United even when an abbreviation is given', () => {
    expect(displayTeamAbbr('Manchester United', 'MAN')).toBe('Red Devils');
  });

  it('returns the abbreviation for any other club', () => {
    expect(displayTeamAbbr('Paris Saint-Germain', 'PSG')).toBe('PSG');
  });

  it('falls back to the full name when no abbreviation is given', () => {
    expect(displayTeamAbbr('Brighton & Hove Albion')).toBe('Brighton & Hove Albion');
  });
});
