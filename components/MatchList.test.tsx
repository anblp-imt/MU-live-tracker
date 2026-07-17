import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchList } from './MatchList';
import type { Match } from '@/lib/types';

function makeMatch(id: string, opponent: string): Match {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition: 'PL',
    home: { name: 'Manchester United FC' }, away: { name: opponent }, venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('MatchList', () => {
  it('renders one card per match, in order', () => {
    render(<MatchList matches={[makeMatch('a', 'Manchester United FC'), makeMatch('b', 'Everton FC')]} />);
    const cards = screen.getAllByTestId('match-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Manchester United FC');
    expect(cards[1]).toHaveTextContent('Everton FC');
  });

  it('shows the empty-state label when there are no matches', () => {
    render(<MatchList matches={[]} emptyLabel="Nothing to see here" />);
    expect(screen.getByText('Nothing to see here')).toBeInTheDocument();
  });

  it('falls back to a default empty-state label', () => {
    render(<MatchList matches={[]} />);
    expect(screen.getByTestId('match-list-empty')).toBeInTheDocument();
  });
});
