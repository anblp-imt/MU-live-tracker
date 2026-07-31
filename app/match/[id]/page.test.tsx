import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from '@/lib/cache';
import type { Match } from '@/lib/types';

vi.mock('@/lib/matches', () => ({ getMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnDetail: vi.fn() }));

import { getMatches } from '@/lib/matches';
import { fetchEspnDetail } from '@/lib/espn';
import { generateMetadata } from './page';

const mockGetMatches = vi.mocked(getMatches);
const mockFetchDetail = vi.mocked(fetchEspnDetail);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '2026-08-16_arsenal',
    utcDate: '2026-08-16T14:00Z',
    status: 'SCHEDULED',
    competition: 'PL',
    home: { name: 'Manchester United' },
    away: { name: 'Arsenal' },
    venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { espn: '401963531' },
    ...overrides,
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('Match detail generateMetadata', () => {
  it('builds a "Home vs Away" title once ESPN detail resolves', async () => {
    mockGetMatches.mockResolvedValue({
      season: '2026-27',
      matches: [makeMatch()],
      meta: { sources: { fd: true, espn: true } },
    });
    mockFetchDetail.mockResolvedValue({
      header: {
        competitions: [{
          status: { type: { state: 'pre' } },
          competitors: [
            { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
            { homeAway: 'away', team: { id: '359', displayName: 'Arsenal' } },
          ],
        }],
      },
    });

    const result = await generateMetadata({ params: Promise.resolve({ id: '2026-08-16_arsenal' }) });

    expect(result.title).toBe('Manchester United vs Arsenal — Glory Glory Man United');
    expect(result.description).toBe('Live score, lineups, stats and match events for Manchester United vs Arsenal.');
    expect(mockFetchDetail).toHaveBeenCalledWith('eng.1', '401963531');
  });

  it('falls back to a generic title when the match id is not found', async () => {
    mockGetMatches.mockResolvedValue({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } });

    const result = await generateMetadata({ params: Promise.resolve({ id: 'does-not-exist' }) });

    expect(result.title).toBe('Match Detail — Glory Glory Man United');
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('falls back to a generic title when the match has no ESPN source', async () => {
    mockGetMatches.mockResolvedValue({
      season: '2026-27',
      matches: [makeMatch({ sources: {} })],
      meta: { sources: { fd: true, espn: false } },
    });

    const result = await generateMetadata({ params: Promise.resolve({ id: '2026-08-16_arsenal' }) });

    expect(result.title).toBe('Match Detail — Glory Glory Man United');
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('falls back to a generic title when the ESPN detail fetch throws', async () => {
    mockGetMatches.mockResolvedValue({
      season: '2026-27',
      matches: [makeMatch()],
      meta: { sources: { fd: true, espn: true } },
    });
    mockFetchDetail.mockRejectedValue(new Error('ESPN request failed: 503'));

    const result = await generateMetadata({ params: Promise.resolve({ id: '2026-08-16_arsenal' }) });

    expect(result.title).toBe('Match Detail — Glory Glory Man United');
  });
});
