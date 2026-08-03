import { fetchBbcNews } from './newsBbc';
import { fetchGuardianNews } from './newsGuardian';
import { fetchEspnNews } from './newsEspn';
import { getCached, setCached, NEWS_TTL_MS } from './cache';
import type { NewsArticle } from './types';

const CACHE_KEY = 'news';

export async function getNews(): Promise<NewsArticle[]> {
  const cached = getCached<NewsArticle[]>(CACHE_KEY);
  if (cached) return cached;

  // Promise.allSettled means one dead source degrades the merged list instead of
  // failing the whole request — same contract as lib/matches.ts.
  const results = await Promise.allSettled([
    fetchBbcNews(),
    fetchGuardianNews(),
    fetchEspnNews(),
  ]);

  const articles = results
    .filter((r): r is PromiseFulfilledResult<NewsArticle[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  setCached(CACHE_KEY, articles, NEWS_TTL_MS);
  return articles;
}
