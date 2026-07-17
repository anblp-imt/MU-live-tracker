import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/espn', () => ({ fetchEspnDetail: vi.fn() }));

import { fetchEspnDetail } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchDetail = vi.mocked(fetchEspnDetail);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

function req(url: string) {
  return new NextRequest(url);
}

describe('GET /api/match/[id]', () => {
  it('rejects a missing slug query param', async () => {
    const res = await GET(req('http://localhost/api/match/740966'), { params: Promise.resolve({ id: '740966' }) });
    expect(res.status).toBe(400);
  });

  it('fetches ESPN detail using the route id as the event id and the slug query param', async () => {
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'post' } } }] } });
    const res = await GET(req('http://localhost/api/match/740966?slug=eng.1'), { params: Promise.resolve({ id: '740966' }) });
    expect(mockFetchDetail).toHaveBeenCalledWith('eng.1', '740966');
    expect(res.status).toBe(200);
  });

  it('caches a finished match longer than a live one', async () => {
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'in' } } }] } });
    await GET(req('http://localhost/api/match/1?slug=eng.1'), { params: Promise.resolve({ id: '1' }) });
    await GET(req('http://localhost/api/match/1?slug=eng.1'), { params: Promise.resolve({ id: '1' }) });
    expect(mockFetchDetail).toHaveBeenCalledTimes(1); // second call served from the 30s live cache
  });
});
