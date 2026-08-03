import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/newsBbc', () => ({ fetchBbcNews: vi.fn() }));
vi.mock('@/lib/newsGuardian', () => ({ fetchGuardianNews: vi.fn() }));
vi.mock('@/lib/newsEspn', () => ({ fetchEspnNews: vi.fn() }));

import { fetchBbcNews } from '@/lib/newsBbc';
import { fetchGuardianNews } from '@/lib/newsGuardian';
import { fetchEspnNews } from '@/lib/newsEspn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';
import type { NewsArticle } from '@/lib/types';

const mockBbc = vi.mocked(fetchBbcNews);
const mockGuardian = vi.mocked(fetchGuardianNews);
const mockEspn = vi.mocked(fetchEspnNews);

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'x', source: 'BBC', sourceUrl: 'https://example.com', title: 'T', summary: 'S',
    publishedAt: '2026-08-01T00:00:00.000Z', ...overrides,
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/news', () => {
  it('merges all three sources sorted by publishedAt descending', async () => {
    mockBbc.mockResolvedValue([article({ id: 'bbc1', source: 'BBC', publishedAt: '2026-08-01T00:00:00.000Z' })]);
    mockGuardian.mockResolvedValue([article({ id: 'gd1', source: 'Guardian', publishedAt: '2026-08-03T00:00:00.000Z' })]);
    mockEspn.mockResolvedValue([article({ id: 'es1', source: 'ESPN', publishedAt: '2026-08-02T00:00:00.000Z' })]);

    const res = await GET();
    const body = await res.json();

    expect(body.articles.map((a: NewsArticle) => a.id)).toEqual(['gd1', 'es1', 'bbc1']);
  });

  it('degrades gracefully when one source fails', async () => {
    mockBbc.mockRejectedValue(new Error('BBC down'));
    mockGuardian.mockResolvedValue([article({ id: 'gd1' })]);
    mockEspn.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.articles).toEqual([article({ id: 'gd1' })]);
    expect(res.status).toBe(200);
  });

  it('returns an empty list when every source fails', async () => {
    mockBbc.mockRejectedValue(new Error('down'));
    mockGuardian.mockRejectedValue(new Error('down'));
    mockEspn.mockRejectedValue(new Error('down'));

    const res = await GET();
    const body = await res.json();

    expect(body.articles).toEqual([]);
  });

  it('serves the second call from cache without calling fetchBbcNews again', async () => {
    mockBbc.mockResolvedValue([]);
    mockGuardian.mockResolvedValue([]);
    mockEspn.mockResolvedValue([]);

    await GET();
    await GET();

    expect(mockBbc).toHaveBeenCalledTimes(1);
  });

  it('does not cache when every source rejects, so a retry can succeed once sources recover', async () => {
    mockBbc.mockRejectedValue(new Error('down'));
    mockGuardian.mockRejectedValue(new Error('down'));
    mockEspn.mockRejectedValue(new Error('down'));

    await GET();
    await GET();

    expect(mockBbc).toHaveBeenCalledTimes(2);
  });

  it('only includes articles published within the last 7 days', async () => {
    const stale = article({
      id: 'stale', source: 'BBC',
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = article({
      id: 'fresh', source: 'Guardian',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockBbc.mockResolvedValue([stale]);
    mockGuardian.mockResolvedValue([fresh]);
    mockEspn.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.articles).toEqual([fresh]);
  });
});
