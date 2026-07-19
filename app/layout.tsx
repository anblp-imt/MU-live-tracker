import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './layout.module.css';
import './globals.css';

const SITE_URL = 'https://gloryglory.vercel.app';
const DESCRIPTION = 'Live scores, schedule, standings, and season stats for Manchester United.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Glory Glory Man United',
  description: DESCRIPTION,
  openGraph: {
    title: 'Glory Glory Man United',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Glory Glory Man United',
    images: [{ url: '/mu-bg.jpg', width: 1536, height: 1024, alt: 'Manchester United' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glory Glory Man United',
    description: DESCRIPTION,
    images: ['/mu-bg.jpg'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav className={styles.nav}>
            <Link href="/">Schedule</Link>
            <Link href="/standings">Standings</Link>
            <Link href="/stats">Stats</Link>
            <span className={styles.chant}>Glory Glory Man United</span>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
