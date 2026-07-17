import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchCard } from './MatchCard';
import type { Match } from '@/lib/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '2026-08-22_hullcityafc',
    utcDate: '2026-08-22T11:30:00Z',
    status: 'SCHEDULED',
    competition: 'PL',
    home: { name: 'Hull City AFC' },
    away: { name: 'Manchester United FC' },
    venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
    ...overrides,
  };
}

describe('MatchCard', () => {
  it('shows the opponent and venue from MU\'s perspective', () => {
    render(<MatchCard match={makeMatch()} />);
    expect(screen.getByText(/vs Hull City AFC \(A\)/)).toBeInTheDocument();
  });

  it('is not a link for a SCHEDULED match', () => {
    render(<MatchCard match={makeMatch({ status: 'SCHEDULED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is not a link for a TIMED match', () => {
    render(<MatchCard match={makeMatch({ status: 'TIMED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is not a link for a POSTPONED match', () => {
    render(<MatchCard match={makeMatch({ status: 'POSTPONED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is a link for an IN_PLAY match', () => {
    render(<MatchCard match={makeMatch({ status: 'IN_PLAY', minute: '23' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('is a link for a FINISHED match', () => {
    render(<MatchCard match={makeMatch({ status: 'FINISHED' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('shows HT for a PAUSED match', () => {
    render(<MatchCard match={makeMatch({ status: 'PAUSED' })} />);
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('shows FT for a FINISHED match with the display score', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED',
      score: { fullTime: { home: 0, away: 2 }, display: { home: 0, away: 2 } },
    })} />);
    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText('0 : 2')).toBeInTheDocument();
  });
});
