import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/fd', () => ({ fetchStandings: vi.fn() }));

import { fetchStandings } from '@/lib/fd';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchStandings = vi.mocked(fetchStandings);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/standings', () => {
  it('rejects a missing/invalid comp param', async () => {
    const res = await GET(new NextRequest('http://localhost/api/standings'));
    expect(res.status).toBe(400);
  });

  it('returns the standings for a valid comp param', async () => {
    mockFetchStandings.mockResolvedValue([{ position: 1 } as never]);
    const res = await GET(new NextRequest('http://localhost/api/standings?comp=PL'));
    const body = await res.json();
    expect(body.standings).toEqual([{ position: 1 }]);
  });

  it('caches the second call for the same comp', async () => {
    mockFetchStandings.mockResolvedValue([]);
    await GET(new NextRequest('http://localhost/api/standings?comp=CL'));
    await GET(new NextRequest('http://localhost/api/standings?comp=CL'));
    expect(mockFetchStandings).toHaveBeenCalledTimes(1);
  });
});
