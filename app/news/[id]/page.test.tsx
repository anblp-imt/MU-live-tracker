import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from '@/lib/cache';
import type { NewsArticle } from '@/lib/types';

vi.mock('@/lib/news', () => ({ getNews: vi.fn() }));

import { getNews } from '@/lib/news';
import { generateMetadata } from './page';

const mockGetNews = vi.mocked(getNews);

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'gd1', source: 'Guardian', sourceUrl: 'https://theguardian.com/story',
    title: 'Defence promises to be a central issue for Carrick and Manchester United',
    summary: 'Question marks remain over the backline.', publishedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('News detail generateMetadata', () => {
  it('builds a title and description from the matched article', async () => {
    mockGetNews.mockResolvedValue([article({})]);

    const result = await generateMetadata({ params: Promise.resolve({ id: 'gd1' }) });

    expect(result.title).toBe('Defence promises to be a central issue for Carrick and Manchester United — Glory Glory Man United');
    expect(result.description).toBe('Question marks remain over the backline.');
    expect(result.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/news/gd1' });
  });

  it('falls back to generic News metadata when no article matches the id', async () => {
    mockGetNews.mockResolvedValue([article({ id: 'other-id' })]);

    const result = await generateMetadata({ params: Promise.resolve({ id: 'missing-id' }) });

    expect(result.title).toBe('News — Glory Glory Man United');
    expect(result.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/news/missing-id' });
  });
});
