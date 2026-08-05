import { XMLParser } from 'fast-xml-parser';
import type { NewsArticle } from './types';
import { newsArticleId } from './newsId';

const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml';

interface BbcRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  'media:thumbnail'?: { '@_url'?: string };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function isWrittenArticle(item: BbcRssItem): boolean {
  return !/\/sounds\//i.test(item.link);
}

const MU_MENTION_RE = /manchester united|man utd|man united/i;

function isAboutMu(item: BbcRssItem): boolean {
  return MU_MENTION_RE.test(item.title) || MU_MENTION_RE.test(item.description);
}

// BBC's general football feed has no field distinguishing men's from women's team
// content, so this is a best-effort text filter, not a guarantee — a player-profile
// piece that never says "women's" or "WSL" (e.g. an interview framed around a single
// player) can still slip through.
const WOMENS_TEAM_RE = /women['’]s|\bwsl\b/i;

function isAboutWomensTeam(item: BbcRssItem): boolean {
  return WOMENS_TEAM_RE.test(item.title) || WOMENS_TEAM_RE.test(item.description);
}

// BBC's RSS feed only provides 240×135 thumbnails. The ichef CDN supports
// on-the-fly resize — swap the width token for a larger one.
function enhanceImageUrl(url: string): string {
  // Format: /ace/standard/240/cpsprodpb/...
  url = url.replace(/\/ace\/standard\/240\//, '/ace/standard/976/');
  // Format: /images/ic/240x135/p0p20njc.jpg
  url = url.replace(/\/images\/ic\/240x135\//, '/images/ic/976x547/');
  return url;
}

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
  const items: BbcRssItem[] = (Array.isArray(raw) ? raw : raw ? [raw] : [])
  .filter(isWrittenArticle)
  .filter(isAboutMu)
  .filter(item => !isAboutWomensTeam(item));

  return items.map(item => {
    const rawUrl = item['media:thumbnail']?.['@_url'];
    return {
      id: newsArticleId('BBC', item.link),
      source: 'BBC' as const,
      sourceUrl: item.link,
      title: item.title,
      summary: item.description,
      imageUrl: rawUrl ? enhanceImageUrl(rawUrl) : undefined,
      publishedAt: new Date(item.pubDate).toISOString(),
    };
  });
}
