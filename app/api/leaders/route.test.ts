import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchMuMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnSchedule: vi.fn(), fetchEspnDetail: vi.fn(), MU_ESPN_ID: 360 }));

import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule, fetchEspnDetail } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';
import type { EspnScheduleEvent, EspnDetail } from '@/lib/types';

const mockFdMatches = vi.mocked(fetchMuMatches);
const mockEspnSchedule = vi.mocked(fetchEspnSchedule);
const mockEspnDetail = vi.mocked(fetchEspnDetail);

function finishedEvent(overrides: Partial<EspnScheduleEvent> = {}): EspnScheduleEvent {
  return {
    id: 'e1',
    date: '2026-08-22T11:30:00Z',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
        { homeAway: 'away', team: { id: '331', displayName: 'Brighton & Hove Albion' } },
      ],
      status: { type: { state: 'post' } },
    }],
    ...overrides,
  };
}

function goalDetail(scorer: string, assist?: string): EspnDetail {
  return {
    header: {
      competitions: [{
        status: { type: { state: 'post' } },
        details: [{
          scoringPlay: true,
          team: { id: '360' },
          participants: assist
            ? [{ athlete: { displayName: scorer } }, { athlete: { displayName: assist } }]
            : [{ athlete: { displayName: scorer } }],
        }],
      }],
    },
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/leaders', () => {
  it('aggregates goals across every finished, non-friendly match', async () => {
    mockFdMatches.mockResolvedValue([]);
    // PL gets one finished match with an espn id; every other competition (CL/FA/EFL/FRIENDLY) gets none.
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent()] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes', 'Amad Diallo'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([{ name: 'Bruno Fernandes', count: 1 }]);
    expect(body.topAssists).toEqual([{ name: 'Amad Diallo', count: 1 }]);
    expect(mockEspnDetail).toHaveBeenCalledTimes(1);
  });

  it('excludes FRIENDLY matches from the aggregation even when finished', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'club.friendly' ? [finishedEvent({ id: 'f1' })] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([]);
    expect(mockEspnDetail).not.toHaveBeenCalled();
  });

  it('tolerates one match detail failing without losing the others (Promise.allSettled)', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent({ id: 'e1' }), finishedEvent({ id: 'e2' })] : []);
    mockEspnDetail
      .mockRejectedValueOnce(new Error('ESPN down for this one'))
      .mockResolvedValueOnce(goalDetail('Bruno Fernandes'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([{ name: 'Bruno Fernandes', count: 1 }]);
    expect(res.status).toBe(200);
  });

  it('caches the result for LEADERS_TTL_MS and skips re-fetching on the next call', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent()] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes'));

    await GET();
    await GET();

    expect(mockEspnSchedule).toHaveBeenCalledTimes(COMPETITIONS_COUNT);
  });
});

const COMPETITIONS_COUNT = 5; // PL, CL, FA, EFL, FRIENDLY — matches lib/competitions.ts
