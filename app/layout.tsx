import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CompetitionFilterProvider } from '@/contexts/CompetitionFilterContext';
import { NavFilterPills } from '@/components/NavFilterPills';
import './globals.css';

export const metadata: Metadata = { title: 'MU Live Tracker' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CompetitionFilterProvider>
          <header>
            <nav>
              <Link href="/">Today</Link>
              {' '}<Link href="/schedule">Schedule</Link>
              {' '}<Link href="/standings">Standings</Link>
            </nav>
            <NavFilterPills />
          </header>
          {children}
        </CompetitionFilterProvider>
      </body>
    </html>
  );
}
