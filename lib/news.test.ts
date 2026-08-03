import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNews } from './news';
import * as newsBbc from './newsBbc';
import * as newsGuardian from './newsGuardian';
import * as newsEspn from './newsEspn';
import * as cache from './cache';
import type { NewsArticle } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  cache.clearCache();
});

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'test-id',
    source: 'BBC',
    sourceUrl: 'https://example.com/article',
    title: 'Test Article',
    summary: 'Test summary',
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getNews', () => {
  beforeEach(() => {
    vi.spyOn(cache, 'getCached').mockReturnValue(undefined);
  });

  it('deduplicates articles with the same id from the same source', async () => {
    const dupArticle = article({
      id: 'dup-1',
      source: 'BBC',
      sourceUrl: 'https://bbc.co.uk/duplicate',
      title: 'Duplicate Article',
    });

    vi.spyOn(newsBbc, 'fetchBbcNews').mockResolvedValue([dupArticle, dupArticle]);
    vi.spyOn(newsGuardian, 'fetchGuardianNews').mockResolvedValue([]);
    vi.spyOn(newsEspn, 'fetchEspnNews').mockResolvedValue([]);

    const results = await getNews();

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('dup-1');
  });

  it('keeps articles with different ids even from the same source', async () => {
    const a1 = article({ id: 'a1', source: 'BBC', sourceUrl: 'https://bbc.co.uk/a1', title: 'Article 1' });
    const a2 = article({ id: 'a2', source: 'BBC', sourceUrl: 'https://bbc.co.uk/a2', title: 'Article 2' });

    vi.spyOn(newsBbc, 'fetchBbcNews').mockResolvedValue([a1, a2]);
    vi.spyOn(newsGuardian, 'fetchGuardianNews').mockResolvedValue([]);
    vi.spyOn(newsEspn, 'fetchEspnNews').mockResolvedValue([]);

    const results = await getNews();

    expect(results).toHaveLength(2);
  });

  it('merges articles from multiple sources without duplicates', async () => {
    const bbc = article({ id: 'bbc-1', source: 'BBC', sourceUrl: 'https://bbc.co.uk/1', title: 'BBC Article' });
    const guardian = article({ id: 'gd-1', source: 'Guardian', sourceUrl: 'https://guardian.co.uk/1', title: 'Guardian Article' });

    vi.spyOn(newsBbc, 'fetchBbcNews').mockResolvedValue([bbc]);
    vi.spyOn(newsGuardian, 'fetchGuardianNews').mockResolvedValue([guardian]);
    vi.spyOn(newsEspn, 'fetchEspnNews').mockResolvedValue([]);

    const results = await getNews();

    expect(results).toHaveLength(2);
    expect(results.map(a => a.source)).toContain('BBC');
    expect(results.map(a => a.source)).toContain('Guardian');
  });
});