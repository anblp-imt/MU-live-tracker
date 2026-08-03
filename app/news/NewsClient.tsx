'use client';
import Link from 'next/link';
import type { NewsArticle } from '@/lib/types';
import { PageHeading } from '@/components/PageHeading';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePolling } from '@/hooks/usePolling';
import { NEWS_TTL_MS } from '@/lib/cache';
import styles from './page.module.css';

async function fetchNews(): Promise<{ articles: NewsArticle[] }> {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error('Failed to load news');
  return res.json();
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NewsClient() {
  const { data, loading, refetch, lastSyncedAt, error } = usePolling(fetchNews, null, { key: 'news', ttlMs: NEWS_TTL_MS });
  const articles = data?.articles ?? [];

  return (
    <main className={styles.main}>
      <PageHeading title="News" onRefresh={refetch} refreshing={loading} lastSyncedAt={lastSyncedAt} error={error} />
      <p className={styles.subtitle}>Latest Manchester United coverage from BBC Sport, The Guardian &amp; ESPN</p>

      {articles.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.list}>
          {articles.map(a => (
            <Link key={a.id} href={`/news/${a.id}`} className={styles.card} data-testid="news-card">
              {a.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable source images
                <img src={a.imageUrl} alt="" className={styles.thumb} />
              )}
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <span className={styles.source} data-source={a.source}>{a.source}</span>
                  <span className={styles.time}>{timeAgo(a.publishedAt)}</span>
                </div>
                <h2 className={styles.cardTitle}>{a.title}</h2>
                <p className={styles.cardSummary}>{a.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
