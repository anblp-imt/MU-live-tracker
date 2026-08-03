'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { NewsArticle } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePolling } from '@/hooks/usePolling';
import { NEWS_TTL_MS } from '@/lib/cache';
import styles from './page.module.css';

async function fetchNews(): Promise<{ articles: NewsArticle[] }> {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error('Failed to load news');
  return res.json();
}

export default function NewsDetailClient() {
  const params = useParams<{ id: string }>();
  // Same cache key ('news') as NewsClient — usePolling seeds from lib/cache.ts's
  // module-level Map, so arriving here from the list page renders instantly from the
  // already-fetched list instead of firing a second request.
  const { data, loading } = usePolling(fetchNews, null, { key: 'news', ttlMs: NEWS_TTL_MS });
  const article = data?.articles.find(a => a.id === params.id);

  if (!article && loading) {
    return (
      <main className={styles.main}>
        <LoadingSpinner />
      </main>
    );
  }

  if (!article) {
    return (
      <main className={styles.main}>
        <p className={styles.notFound} data-testid="news-not-found">This article isn&apos;t available anymore.</p>
        <Link href="/news" className={styles.backLink}>← Back to News</Link>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Link href="/news" className={styles.backLink}>← Back to News</Link>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable source images
        <img src={article.imageUrl} alt="" className={styles.detailImg} />
      )}
      <div className={styles.detailMeta}>
        <span className={styles.source} data-source={article.source}>{article.source}</span>
      </div>
      <h1 className={styles.detailTitle}>{article.title}</h1>
      <p className={styles.detailSummary}>{article.summary}</p>
      <a className={styles.readMore} href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
        Read full article on {article.source} ↗
      </a>
      <p className={styles.attribution}>Summary and image via {article.source}&apos;s public feed. Full article, reporting and images © {article.source}.</p>
    </main>
  );
}
