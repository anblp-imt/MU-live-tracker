import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchMuMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnSchedule: vi.fn() }));

import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFdMatches = vi.mocked(fetchMuMatches);
const mockEspnSchedule = vi.mocked(fetchEspnSchedule);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/matches', () => {
  it('merges FD + ESPN and reports both sources as available on success', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: true, espn: true });
    expect(body.matches).toEqual([]);
    expect(body.season).toMatch(/^\d{4}-\d{2}$/);
  });

  it('degrades gracefully when football-data fails but ESPN succeeds', async () => {
    mockFdMatches.mockRejectedValue(new Error('FD down'));
    mockEspnSchedule.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: false, espn: true });
    expect(res.status).toBe(200);
  });

  it('degrades gracefully when every ESPN call fails but football-data succeeds', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockRejectedValue(new Error('ESPN down'));

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: true, espn: false });
  });

  it('serves the second call from cache without calling fetchMuMatches again', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockResolvedValue([]);

    await GET();
    await GET();

    expect(mockFdMatches).toHaveBeenCalledTimes(1);
  });
});
