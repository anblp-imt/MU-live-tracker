import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { NewsArticle } from '@/lib/types';

const mockParams = { id: 'gd1' };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

import NewsDetailClient from './NewsDetailClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'gd1', source: 'Guardian', sourceUrl: 'https://theguardian.com/story',
    title: 'Defence promises to be a central issue',
    summary: 'Question marks remain over the backline.', publishedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockNewsResponse(articles: NewsArticle[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ articles }) }));
}

describe('NewsDetailClient', () => {
  it('renders the matched article with a link back to its source', async () => {
    mockNewsResponse([article({})]);

    render(<NewsDetailClient />);

    await waitFor(() => expect(screen.getByText('Defence promises to be a central issue')).toBeInTheDocument());
    expect(screen.getByText('Question marks remain over the backline.')).toBeInTheDocument();
    expect(screen.getByText('Guardian')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Read full article on Guardian/ });
    expect(link).toHaveAttribute('href', 'https://theguardian.com/story');
    expect(link).not.toHaveAttribute('target');
  });

  it('shows a not-found state and a link back to /news when no article matches the id', async () => {
    mockNewsResponse([article({ id: 'some-other-id' })]);

    render(<NewsDetailClient />);

    await waitFor(() => expect(screen.getByTestId('news-not-found')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Back to News/ })).toHaveAttribute('href', '/news');
  });
});
