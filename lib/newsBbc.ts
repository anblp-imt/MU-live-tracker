import { XMLParser } from 'fast-xml-parser';
import type { NewsArticle } from './types';
import { newsArticleId } from './newsId';

const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/football/teams/manchester-united/rss.xml';

interface BbcRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  'media:thumbnail'?: { '@_url'?: string };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export async function fetchBbcNews(): Promise<NewsArticle[]> {
  let res: Response;
  try {
    res = await fetch(BBC_FEED_URL);
  } catch (e) {
    throw new Error('BBC network error: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) throw new Error(`BBC HTTP ${res.status}`);
  const xml = await res.text();

  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item;
  const items: BbcRssItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return items.map(item => ({
    id: newsArticleId('BBC', item.link),
    source: 'BBC' as const,
    sourceUrl: item.link,
    title: item.title,
    summary: item.description,
    imageUrl: item['media:thumbnail']?.['@_url'],
    publishedAt: new Date(item.pubDate).toISOString(),
  }));
}
