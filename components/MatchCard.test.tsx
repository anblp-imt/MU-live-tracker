import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MatchCard } from './MatchCard';
import type { Match } from '@/lib/types';

afterEach(() => vi.useRealTimers());

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
    expect(screen.getByText(/Hull City AFC \(A\)/)).toBeInTheDocument();
  });

  it('shows a competition tag using the shared short label', () => {
    render(<MatchCard match={makeMatch({ competition: 'CL' })} />);
    expect(screen.getByText('UCL')).toBeInTheDocument();
  });

  it('is a link for a SCHEDULED match', () => {
    render(<MatchCard match={makeMatch({ status: 'SCHEDULED' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('is a link for a TIMED match', () => {
    render(<MatchCard match={makeMatch({ status: 'TIMED' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
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

  it('shows no score placeholder for a match that has not kicked off', () => {
    render(<MatchCard match={makeMatch({ status: 'SCHEDULED' })} />);
    expect(screen.queryByText('- - -')).not.toBeInTheDocument();
    expect(screen.getByTestId('match-score')).toHaveTextContent('');
  });

  it('shows FT for a FINISHED match with the display score', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED',
      score: { fullTime: { home: 0, away: 2 }, display: { home: 0, away: 2 } },
    })} />);
    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText('0 - 2')).toBeInTheDocument();
  });

  it('shows FERGIE TIME instead of the minute when MU is not winning in the 90th', () => {
    render(<MatchCard match={makeMatch({
      status: 'IN_PLAY', minute: '90', venue: 'H',
      score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } },
    })} />);
    expect(screen.getByText('FERGIE TIME')).toBeInTheDocument();
  });

  it('colors the score green when MU wins as the home side', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED', venue: 'H',
      score: { fullTime: { home: 2, away: 1 }, display: { home: 2, away: 1 } },
    })} />);
    expect(screen.getByText('2 - 1').className).toMatch(/_win_/);
  });

  it('colors the score gold when MU draws', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED', venue: 'H',
      score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } },
    })} />);
    expect(screen.getByText('1 - 1').className).toMatch(/_draw_/);
  });

  it('colors the score red when MU loses as the away side', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED', venue: 'A',
      score: { fullTime: { home: 2, away: 0 }, display: { home: 2, away: 0 } },
    })} />);
    expect(screen.getByText('2 - 0').className).toMatch(/_loss_/);
  });

  it('does not apply a result color before the match is finished', () => {
    render(<MatchCard match={makeMatch({
      status: 'IN_PLAY', minute: '23',
      score: { fullTime: { home: 1, away: 0 }, display: { home: 1, away: 0 } },
    })} />);
    const score = screen.getByText('1 - 0');
    expect(score.className).not.toMatch(/_win_|_draw_|_loss_/);
  });

  it('briefly flags a live update when the score changes between polls, then clears it', () => {
    vi.useFakeTimers();
    const live = makeMatch({
      status: 'IN_PLAY', minute: '23',
      score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } },
    });
    const { rerender } = render(<MatchCard match={live} />);
    expect(screen.getByTestId('match-card')).not.toHaveAttribute('data-live-update');

    rerender(<MatchCard match={{ ...live, minute: '24', score: { fullTime: { home: 1, away: 0 }, display: { home: 1, away: 0 } } }} />);
    expect(screen.getByTestId('match-card')).toHaveAttribute('data-live-update', 'true');

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByTestId('match-card')).not.toHaveAttribute('data-live-update');
  });

  it('does not flag a live update on the first render', () => {
    render(<MatchCard match={makeMatch({ status: 'IN_PLAY', minute: '10' })} />);
    expect(screen.getByTestId('match-card')).not.toHaveAttribute('data-live-update');
  });

  it('does not flag a live update when re-rendered with identical data', () => {
    const live = makeMatch({ status: 'IN_PLAY', minute: '10' });
    const { rerender } = render(<MatchCard match={live} />);
    rerender(<MatchCard match={{ ...live }} />);
    expect(screen.getByTestId('match-card')).not.toHaveAttribute('data-live-update');
  });
});
