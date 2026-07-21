import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Match } from '@/lib/types';

vi.mock('@/lib/espn', () => ({ fetchEspnDetail: vi.fn(), fetchEspnSchedule: vi.fn() }));
vi.mock('@/lib/fd', () => ({ fetchMuMatches: vi.fn() }));

import { fetchEspnDetail, fetchEspnSchedule } from '@/lib/espn';
import { fetchMuMatches } from '@/lib/fd';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchDetail = vi.mocked(fetchEspnDetail);
const mockEspnSchedule = vi.mocked(fetchEspnSchedule);
const mockFdMatches = vi.mocked(fetchMuMatches);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '2026-07-18_wrexham',
    utcDate: '2026-07-18T15:00Z',
    status: 'FINISHED',
    competition: 'FRIENDLY',
    home: { name: 'Manchester United' },
    away: { name: 'Wrexham' },
    venue: 'H',
    score: { fullTime: { home: 0, away: 1 }, display: { home: 0, away: 1 } },
    sources: { espn: '401863531' },
    ...overrides,
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
  mockFdMatches.mockResolvedValue([]);
  mockEspnSchedule.mockResolvedValue([]);
});

function req(url: string) {
  return new NextRequest(url);
}

describe('GET /api/match/[id]', () => {
  it("looks up the match's ESPN id and competition slug from the app's own match id — no espnId/slug in the request", async () => {
    mockEspnSchedule.mockImplementation(async slug =>
      slug === 'club.friendly' ? [{
        id: '401863531',
        date: '2026-07-18T15:00Z',
        competitions: [{
          status: { type: { state: 'post' } },
          competitors: [
            { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
            { homeAway: 'away', team: { id: '352', displayName: 'Wrexham' } },
          ],
        }],
      }] : [],
    );
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'post' } } }] } });

    const res = await GET(req('http://localhost/api/match/2026-07-18_wrexham'), { params: Promise.resolve({ id: '2026-07-18_wrexham' }) });

    expect(mockFetchDetail).toHaveBeenCalledWith('club.friendly', '401863531');
    expect(res.status).toBe(200);
  });

  it('404s when the app match id is not found', async () => {
    const res = await GET(req('http://localhost/api/match/does-not-exist'), { params: Promise.resolve({ id: 'does-not-exist' }) });
    expect(res.status).toBe(404);
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('caches a finished match longer than a live one', async () => {
    mockEspnSchedule.mockImplementation(async slug =>
      slug === 'club.friendly' ? [{
        id: '401863531',
        date: '2026-07-18T15:00Z',
        competitions: [{
          status: { type: { state: 'post' } },
          competitors: [
            { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
            { homeAway: 'away', team: { id: '352', displayName: 'Wrexham' } },
          ],
        }],
      }] : [],
    );
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'in' } } }] } });

    await GET(req('http://localhost/api/match/2026-07-18_wrexham'), { params: Promise.resolve({ id: '2026-07-18_wrexham' }) });
    await GET(req('http://localhost/api/match/2026-07-18_wrexham'), { params: Promise.resolve({ id: '2026-07-18_wrexham' }) });

    expect(mockFetchDetail).toHaveBeenCalledTimes(1); // second call served from the 30s live cache
  });
});
