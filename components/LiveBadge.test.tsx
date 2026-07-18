import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveBadge, isFergieTime } from './LiveBadge';
import type { Match } from '@/lib/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'x', utcDate: '2026-08-22T11:30:00Z', status: 'IN_PLAY', competition: 'PL',
    home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A',
    score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } },
    minute: '90', sources: { fd: 1 },
    ...overrides,
  };
}

describe('isFergieTime', () => {
  it('is true at minute 90+ while MU is drawing away', () => {
    expect(isFergieTime(makeMatch({ venue: 'A', minute: '90', score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } } }))).toBe(true);
  });

  it('is true at minute 90+ while MU is losing at home', () => {
    expect(isFergieTime(makeMatch({ venue: 'H', minute: "90'+2'", score: { fullTime: { home: 0, away: 1 }, display: { home: 0, away: 1 } } }))).toBe(true);
  });

  it('is false while MU is winning', () => {
    expect(isFergieTime(makeMatch({ venue: 'H', minute: '90', score: { fullTime: { home: 2, away: 0 }, display: { home: 2, away: 0 } } }))).toBe(false);
  });

  it('is false before minute 90', () => {
    expect(isFergieTime(makeMatch({ minute: '75' }))).toBe(false);
  });

  it('is false when the match is not IN_PLAY', () => {
    expect(isFergieTime(makeMatch({ status: 'PAUSED' }))).toBe(false);
  });
});

describe('LiveBadge', () => {
  it('renders HT for a PAUSED match', () => {
    render(<LiveBadge match={makeMatch({ status: 'PAUSED' })} />);
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('renders FERGIE TIME when isFergieTime is true', () => {
    render(<LiveBadge match={makeMatch({ venue: 'H', minute: '91', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } } })} />);
    expect(screen.getByText('FERGIE TIME')).toBeInTheDocument();
  });

  it('renders the plain minute when not Fergie Time', () => {
    // ESPN's displayClock already includes the trailing apostrophe (e.g. "40'") —
    // LiveBadge must not append a second one on top of it.
    render(<LiveBadge match={makeMatch({ minute: "40'" })} />);
    expect(screen.getByText("40'")).toBeInTheDocument();
  });

  it('renders nothing for a non-live match', () => {
    const { container } = render(<LiveBadge match={makeMatch({ status: 'FINISHED' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
