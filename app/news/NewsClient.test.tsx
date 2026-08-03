import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NewsClient from './NewsClient';
import type { NewsArticle } from '@/lib/types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'bbc1', source: 'BBC', sourceUrl: 'https://bbc.co.uk/story', title: 'Fraizer Campbell on United',
    summary: 'A short summary.', publishedAt: new Date().toISOString(), ...overrides,
  };
}

function mockNewsResponse(articles: NewsArticle[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ articles }) }));
}

describe('NewsClient', () => {
  it('renders a card with source, title, and summary for each article', async () => {
    mockNewsResponse([
      article({ id: 'bbc1', source: 'BBC', title: 'Fraizer Campbell on United', summary: 'A short summary.' }),
      article({ id: 'gd1', source: 'Guardian', title: 'Defence promises to be central issue', summary: 'Another summary.' }),
    ]);

    render(<NewsClient />);

    await waitFor(() => expect(screen.getByText('Fraizer Campbell on United')).toBeInTheDocument());
    expect(screen.getByText('A short summary.')).toBeInTheDocument();
    expect(screen.getByText('Defence promises to be central issue')).toBeInTheDocument();
    expect(screen.getAllByText('BBC')).toHaveLength(1);
    expect(screen.getAllByText('Guardian')).toHaveLength(1);
  });

  it('links each card to its article detail route', async () => {
    mockNewsResponse([article({ id: 'bbc1', title: 'Fraizer Campbell on United' })]);

    render(<NewsClient />);

    await waitFor(() => expect(screen.getByText('Fraizer Campbell on United')).toBeInTheDocument());
    expect(screen.getByTestId('news-card')).toHaveAttribute('href', '/news/bbc1');
  });

  it('shows an empty state instead of an infinite spinner when the fetch succeeds with zero articles', async () => {
    mockNewsResponse([]);

    render(<NewsClient />);

    await waitFor(() => expect(screen.getByTestId('news-empty')).toBeInTheDocument());
  });

  it('renders source filter chips and filters articles when a source is selected', async () => {
    mockNewsResponse([
      article({ id: 'bbc1', source: 'BBC', title: 'BBC article' }),
      article({ id: 'gd1', source: 'Guardian', title: 'Guardian article' }),
      article({ id: 'es1', source: 'ESPN', title: 'ESPN article' }),
    ]);

    render(<NewsClient />);

    await waitFor(() => expect(screen.getByText('BBC article')).toBeInTheDocument());

    // Filter chips should be visible
    const allChip = screen.getByRole('button', { name: /all/i });
    const bbcChip = screen.getByRole('button', { name: /bbc/i });
    expect(allChip).toBeInTheDocument();
    expect(bbcChip).toBeInTheDocument();

    // Click BBC chip — should only show BBC article
    bbcChip.click();

    await waitFor(() => {
      expect(screen.getByText('BBC article')).toBeInTheDocument();
      expect(screen.queryByText('Guardian article')).not.toBeInTheDocument();
      expect(screen.queryByText('ESPN article')).not.toBeInTheDocument();
    });
  });
});
