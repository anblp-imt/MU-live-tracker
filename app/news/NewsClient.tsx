'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { NewsArticle } from '@/lib/types';
import { PageHeading } from '@/components/PageHeading';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePolling } from '@/hooks/usePolling';
import { NEWS_TTL_MS } from '@/lib/cache';
import { timeAgo } from '@/lib/newsFormat';
import styles from './page.module.css';

async function fetchNews(force = false): Promise<{ articles: NewsArticle[] }> {
  const res = await fetch(`/api/news${force ? '?force=1' : ''}`);
  if (!res.ok) throw new Error('Failed to load news');
  return res.json();
}

export default function NewsClient() {
  const { data, loading, refetch, lastSyncedAt, error } = usePolling(fetchNews, null, { key: 'news', ttlMs: NEWS_TTL_MS });
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const allArticles = data?.articles ?? [];
  const articles = selectedSource
    ? allArticles.filter(a => a.source === selectedSource)
    : allArticles;

  return (
    <main className={styles.main}>
      <PageHeading title="News" onRefresh={refetch} refreshing={loading} lastSyncedAt={lastSyncedAt} error={error} />
      <p className={styles.subtitle}>Latest Manchester United coverage from BBC Sport, The Guardian &amp; ESPN</p>

      <div className={styles.filterBar}>
        <button
          className={!selectedSource ? styles.filterChipActive : styles.filterChip}
          data-source="All"
          onClick={() => setSelectedSource(null)}
          type="button"
        >
          All ({allArticles.length})
        </button>
        {(['BBC', 'Guardian', 'ESPN'] as const).map(source => {
          const count = allArticles.filter(a => a.source === source).length;
          return (
            <button
              key={source}
              className={selectedSource === source ? styles.filterChipActive : styles.filterChip}
              data-source={source}
              onClick={() => setSelectedSource(source)}
              type="button"
            >
              {source} ({count})
            </button>
          );
        })}
      </div>

      {data === null ? (
        <LoadingSpinner />
      ) : articles.length === 0 ? (
        <p className={styles.empty} data-testid="news-empty">No news to show right now — try refreshing.</p>
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
