'use client';
import { useEffect, useState } from 'react';
import styles from './PageHeading.module.css';

function formatClock(d: Date): string {
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

function formatSyncTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// [React] Shared by Today, Schedule, Standings, and the match detail page — a plain
// reusable component rather than copy-pasting the same rule+clock markup four times.
// The clock starts as null and is set inside an effect (not computed inline during
// render) so the very first render — the one that could theoretically be reused between
// server and client — never bakes in a `new Date()` value; the interval then re-renders
// this component every second purely from local state, with no data fetch involved.
//
// onRefresh/refreshing/lastSyncedAt/error are optional: the match detail page (which
// doesn't render PageHeading at all, having its own <h1>) gets its own copy of this same
// button+status instead — see app/match/[id]/page.tsx.
export function PageHeading({
  title, onRefresh, refreshing, lastSyncedAt, error,
}: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  lastSyncedAt?: number | null;
  error?: Error | null;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className={styles.headRow}>
        <h1>{title}</h1>
        {onRefresh && (
          <div className={styles.refreshGroup}>
            {/* Confirms a refresh actually landed, not just that one was requested —
                without this, the spinning icon during the fetch is the only feedback,
                and it's gone by the time you'd look for it. */}
            {!refreshing && error && (
              <span className={styles.syncErr} data-testid="sync-status">✗ Refresh failed</span>
            )}
            {!refreshing && !error && lastSyncedAt != null && (
              <span className={styles.syncOk} data-testid="sync-status">✓ Synced {formatSyncTime(lastSyncedAt)}</span>
            )}
            <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={refreshing}>
              <span className={refreshing ? styles.spinning : undefined} aria-hidden="true">↻</span> Refresh
            </button>
          </div>
        )}
      </div>
      <div className={styles.rule} />
      <p className={styles.kicker} data-testid="page-clock">{now ? formatClock(now) : ''}</p>
    </>
  );
}
