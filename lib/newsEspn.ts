import { espnFetch } from './espn';
import type { NewsArticle } from './types';
import { newsArticleId } from './newsId';

interface EspnNewsArticle {
  headline: string;
  description: string;
  published: string;
  images?: { url: string }[];
  links?: { web?: { href?: string } };
}

export async function fetchEspnNews(): Promise<NewsArticle[]> {
  const data = (await espnFetch('/eng.1/news?team=360')) as { articles?: EspnNewsArticle[] };
  const articles = data.articles ?? [];

  return articles
    .filter((a): a is EspnNewsArticle & { links: { web: { href: string } } } => Boolean(a.links?.web?.href))
    .map(a => ({
      id: newsArticleId('ESPN', a.links.web.href),
      source: 'ESPN' as const,
      sourceUrl: a.links.web.href,
      title: a.headline,
      summary: a.description,
      imageUrl: a.images?.[0]?.url,
      publishedAt: new Date(a.published).toISOString(),
    }));
}
