import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from './page';
import type { MatchesResponse } from '@/lib/types';
import { clearCache } from '@/lib/cache';

// Pinned so "is this month in the past" (the default-collapse rule) doesn't drift as
// real time passes — without this, these tests would start failing once the real date
// moves past July 2026, exactly the kind of test-suite decay a fixed clock avoids.
beforeEach(() => {
  // usePolling's client cache is a module-level Map shared across every test in this
  // file (and, without this, could leak a previous test's mocked matches into the next
  // one via the 'matches' cache key) — clear it so each test starts from a real fetch.
  clearCache();
  // Fake only Date, not setTimeout/setInterval — waitFor() and userEvent both rely on
  // real timers internally, and faking those too makes them hang indefinitely.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string, utcDate = '2026-08-22T11:30:00Z'): MatchesResponse['matches'][number] {
  return {
    id, utcDate, status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('SchedulePage', () => {
  it('shows all matches by default (local ALL state, no shared Context)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Manchester United FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
  });

  it('filters to one competition when its tab is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Arsenal FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));

    await userEvent.click(screen.getByRole('tab', { name: 'PL' }));
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(1));
    expect(screen.getByText(/Hull City AFC/)).toBeInTheDocument();
  });

  it('groups fixtures under a month heading per calendar month', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [
          match('a', 'PL', 'Arsenal FC', '2026-07-18T15:00:00Z'),
          match('b', 'PL', 'Chelsea FC', '2026-08-22T11:30:00Z'),
        ],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
    expect(screen.getByRole('heading', { level: 2, name: 'July 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'August 2026' })).toBeInTheDocument();
  });

  it('collapses and re-expands a month group when its heading is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [
          match('a', 'PL', 'Arsenal FC', '2026-07-18T15:00:00Z'),
          match('b', 'PL', 'Chelsea FC', '2026-08-22T11:30:00Z'),
        ],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));

    const julyHeading = screen.getByRole('button', { name: /July 2026/ });
    await userEvent.click(julyHeading);
    // Both fixtures render "Hull City AFC (A)" (the venue is 'A' in both, so MatchCard
    // shows the home team, per its MU-perspective rule) — the collapse behavior itself
    // is what's under test here, verified by count rather than which name shows.
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(1));

    await userEvent.click(julyHeading);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
  });

  it('starts past months collapsed and the current/future month expanded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [
          match('a', 'PL', 'Arsenal FC', '2026-05-10T15:00:00Z'), // past relative to "now" (18 Jul 2026)
          match('b', 'PL', 'Chelsea FC', '2026-07-18T15:00:00Z'), // current month
        ],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2));

    // Only the current month's fixture is visible; May's is collapsed by default.
    expect(screen.getAllByTestId('match-card')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /May 2026/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /July 2026/ })).toHaveAttribute('aria-expanded', 'true');
  });
});
