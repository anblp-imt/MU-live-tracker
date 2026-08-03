import { XMLParser } from 'fast-xml-parser';
import type { NewsArticle } from './types';
import { newsArticleId } from './newsId';

const GUARDIAN_FEED_URL = 'https://www.theguardian.com/football/manchesterunited/rss';

interface GuardianMediaContent {
  '@_url'?: string;
  '@_width'?: string;
}

interface GuardianRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  'media:content'?: GuardianMediaContent | GuardianMediaContent[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Guardian's <description> is HTML — a couple of <p> tags plus a trailing link back to
// the same article ("Continue reading...") that's redundant with this app's own
// "Read full article" CTA on the detail page, so it's stripped along with every other
// tag. &nbsp; survives fast-xml-parser's entity decoding (it only resolves the 5 base
// XML entities, not named HTML ones), so it's replaced by hand.
function htmlToSummary(html: string): string {
  return html
    .replace(/<a[^>]*>Continue reading\.\.\.<\/a>\s*$/i, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickImage(mediaContent: GuardianRssItem['media:content']): string | undefined {
  if (!mediaContent) return undefined;
  const list = Array.isArray(mediaContent) ? mediaContent : [mediaContent];
  const withWidth = list
    .map(m => ({ url: m['@_url'], width: Number(m['@_width']) || 0 }))
    .filter((m): m is { url: string; width: number } => Boolean(m.url));
  if (withWidth.length === 0) return undefined;
  return withWidth.sort((a, b) => b.width - a.width)[0].url;
}

export async function fetchGuardianNews(): Promise<NewsArticle[]> {
  let res: Response;
  try {
    res = await fetch(GUARDIAN_FEED_URL);
  } catch (e) {
    throw new Error('Guardian network error: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) throw new Error(`Guardian HTTP ${res.status}`);
  const xml = await res.text();

  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item;
  const items: GuardianRssItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return items.map(item => ({
    id: newsArticleId('Guardian', item.link),
    source: 'Guardian' as const,
    sourceUrl: item.link,
    title: item.title,
    summary: htmlToSummary(item.description),
    imageUrl: pickImage(item['media:content']),
    publishedAt: new Date(item.pubDate).toISOString(),
  }));
}
