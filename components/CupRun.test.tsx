import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CupRun } from './CupRun';
import type { Match } from '@/lib/types';

function match(id: string, competition: Match['competition'], utcDate: string, opponent: string): Match {
  return {
    id, utcDate, status: 'SCHEDULED', competition,
    home: { name: 'Manchester United FC' }, away: { name: opponent }, venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('CupRun', () => {
  it('shows only matches for the requested competition, sorted by date', () => {
    render(<CupRun matches={[
      match('b', 'FA', '2027-01-10T15:00:00Z', 'Round 4 Opponent'),
      match('a', 'FA', '2026-12-01T15:00:00Z', 'Round 3 Opponent'),
      match('c', 'EFL', '2026-11-01T15:00:00Z', 'Not FA'),
    ]} competition="FA" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Round 3 Opponent');
    expect(items[1]).toHaveTextContent('Round 4 Opponent');
  });

  it('shows a placeholder when there are no fixtures yet', () => {
    render(<CupRun matches={[]} competition="EFL" />);
    expect(screen.getByText(/no fixtures yet/i)).toBeInTheDocument();
  });
});
