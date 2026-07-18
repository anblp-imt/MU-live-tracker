import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './layout.module.css';
import './globals.css';

export const metadata: Metadata = { title: 'MU Live Tracker' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav className={styles.nav}>
            <Link href="/">Today</Link>
            <Link href="/schedule">Schedule</Link>
            <Link href="/standings">Standings</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
