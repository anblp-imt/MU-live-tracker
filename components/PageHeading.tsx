'use client';
import { useEffect, useState } from 'react';
import styles from './PageHeading.module.css';

function formatClock(d: Date): string {
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

// [React] Shared by Today, Schedule, Standings, and the match detail page — a plain
// reusable component rather than copy-pasting the same rule+clock markup four times.
// The clock starts as null and is set inside an effect (not computed inline during
// render) so the very first render — the one that could theoretically be reused between
// server and client — never bakes in a `new Date()` value; the interval then re-renders
// this component every second purely from local state, with no data fetch involved.
export function PageHeading({ title }: { title: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <h1>{title}</h1>
      <div className={styles.rule} />
      <p className={styles.kicker} data-testid="page-clock">{now ? formatClock(now) : ''}</p>
    </>
  );
}
