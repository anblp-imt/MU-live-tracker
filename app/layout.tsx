import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NavLink } from '@/components/NavLink';
import { buildMetadata, buildJsonLd, SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/seo';
import styles from './layout.module.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...buildMetadata({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, path: '/' }),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()).replace(/</g, '\\u003c') }}
        />
        <header>
          <nav className={styles.nav}>
            <NavLink href="/">Schedule</NavLink>
            <NavLink href="/standings">Standings</NavLink>
            <NavLink href="/stats">Stats</NavLink>
            <NavLink href="/team">Team</NavLink>
            <span className={styles.chant}>Glory Glory Man United</span>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
