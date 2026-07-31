# Social & Search SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every route correct, per-page Open Graph/Twitter Card metadata (for
Facebook/Zalo/X/LinkedIn/TikTok link previews), plus `sitemap.xml`, `robots.txt`, and
baseline JSON-LD, so the site is professionally discoverable and shareable.

**Architecture:** Next.js only allows `metadata`/`generateMetadata` exports from Server
Components, but every route today is `'use client'`. Each route that needs metadata
different from the site default gets split into a thin Server `page.tsx` (owns
metadata) + a `*Client.tsx` file (owns the existing UI/polling logic, moved verbatim).
A shared `lib/seo.ts` helper builds the repeated Open Graph/Twitter/JSON-LD shape.

**Tech Stack:** Next.js 16 App Router Metadata API (`Metadata`, `generateMetadata`,
`MetadataRoute.Sitemap`, `MetadataRoute.Robots`), Vitest + Testing Library (existing).

## Global Constraints

- `metadata` / `generateMetadata` exports are **only** valid in Server Components — a
  file with `'use client'` at the top cannot export either. (Confirmed via
  `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`.)
- Next.js does **not** deep-merge nested `Metadata` fields between parent and child
  routes — if a route defines its own `openGraph`, that object fully replaces the
  parent's rather than merging key-by-key. Every route with an `openGraph` override must
  supply the complete block (title, description, url, siteName, images, locale, type).
- The `/` route (Schedule page) keeps the root layout's default metadata as-is — its
  title/description are identical to the site default, so it does **not** need a
  Server/Client split. Do not create a `ScheduleClient.tsx` — that would be an
  unnecessary change with no behavioral effect.
- `SITE_URL` (`https://gloryglory.vercel.app`) lives in exactly one place: `lib/seo.ts`.
  Never hardcode the domain elsewhere.
- Match detail's OG image is the same static shared image used everywhere else — no
  `next/og` `ImageResponse` / per-match generated images.
- Sitemap covers only the 4 static routes (`/`, `/standings`, `/stats`, `/team`) — no
  per-match `/match/[id]` entries.
- JSON-LD is `WebSite` + `SportsTeam` only, site-wide (in the root layout) — no
  per-match `SportsEvent` schema.
- Moving existing client logic into a new `*Client.tsx` file must not change its
  behavior — same JSX, same hooks, same tests passing, only the file location and the
  component's function name change.

---

### Task 1: `lib/seo.ts` metadata helper

**Files:**
- Create: `lib/seo.ts`
- Test: `lib/seo.test.ts`

**Interfaces:**
- Produces: `SITE_URL: string`, `SITE_NAME: string`, `DEFAULT_DESCRIPTION: string`,
  `DEFAULT_OG_IMAGE: { url: string; width: number; height: number; alt: string }`,
  `buildMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata`,
  `buildJsonLd(): object` — all consumed by every task below.

- [ ] **Step 1: Write the failing test**

```ts
// lib/seo.test.ts
import { describe, it, expect } from 'vitest';
import { buildMetadata, buildJsonLd, SITE_URL, SITE_NAME } from './seo';

describe('buildMetadata', () => {
  it('builds a complete Metadata object with matching title/description everywhere', () => {
    const result = buildMetadata({
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      path: '/standings',
    });

    expect(result.title).toBe('Standings — Glory Glory Man United');
    expect(result.description).toBe('Test description.');
    expect(result.alternates).toEqual({ canonical: `${SITE_URL}/standings` });

    expect(result.openGraph).toMatchObject({
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      url: `${SITE_URL}/standings`,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
    });
    expect(result.openGraph?.images).toEqual([
      { url: '/mu-bg.jpg', width: 1536, height: 1024, alt: 'Manchester United' },
    ]);

    expect(result.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      images: ['/mu-bg.jpg'],
    });
  });

  it('resolves the root path without a double slash', () => {
    const result = buildMetadata({ title: 'Home', description: 'x', path: '/' });
    expect(result.alternates).toEqual({ canonical: SITE_URL });
    expect(result.openGraph?.url).toBe(SITE_URL);
  });
});

describe('buildJsonLd', () => {
  it('returns a WebSite + SportsTeam graph', () => {
    const jsonLd = buildJsonLd() as { '@context': string; '@graph': Array<{ '@type': string }> };
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@graph']).toEqual([
      { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      { '@type': 'SportsTeam', name: 'Manchester United', sport: 'Soccer', url: SITE_URL },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/seo.test.ts`
Expected: FAIL — `lib/seo.ts` does not exist yet ("Cannot find module './seo'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/seo.ts
import type { Metadata } from 'next';

export const SITE_URL = 'https://gloryglory.vercel.app';
export const SITE_NAME = 'Glory Glory Man United';
export const DEFAULT_DESCRIPTION = 'Live scores, schedule, standings, and season stats for Manchester United.';
export const DEFAULT_OG_IMAGE = { url: '/mu-bg.jpg', width: 1536, height: 1024, alt: 'Manchester United' };

interface BuildMetadataInput {
  title: string;
  description: string;
  // Route path, e.g. '/standings' or '/' — resolved against SITE_URL for canonical/OG urls.
  path: string;
}

// Next.js does not deep-merge a child route's `openGraph`/`twitter` objects with the
// parent layout's — a route that defines either fully replaces it. Every route that
// overrides metadata must go through this helper so it always gets the complete block.
export function buildMetadata({ title, description, path }: BuildMetadataInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [DEFAULT_OG_IMAGE],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export function buildJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      { '@type': 'SportsTeam', name: 'Manchester United', sport: 'Soccer', url: SITE_URL },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/seo.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/seo.ts lib/seo.test.ts
git commit -m "feat: add buildMetadata/buildJsonLd SEO helpers"
```

---

### Task 2: Root layout uses `buildMetadata` + adds JSON-LD

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `buildMetadata`, `buildJsonLd`, `SITE_URL`, `SITE_NAME`, `DEFAULT_DESCRIPTION`
  from `lib/seo.ts` (Task 1).

This task has no new pure-function behavior to unit test in isolation (it wires two
already-tested helpers into a Server Component). Verify it by running the full suite
and confirming no regressions, then a manual `npm run dev` visual check.

- [ ] **Step 1: Replace the inline metadata object and constants**

Current top of `app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NavLink } from '@/components/NavLink';
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
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Add the JSON-LD script tag to the body**

Current `RootLayout`:

```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
```

Replace with:

```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()).replace(/</g, '\\u003c') }}
        />
        <header>
```

(The rest of the file — nav links, `{children}`, closing tags — is unchanged.)

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS, same test count as before this task.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `http://localhost:3000`, view page source, confirm:
- `<title>Glory Glory Man United</title>` still present
- `<meta property="og:title" content="Glory Glory Man United">` still present
- a `<script type="application/ld+json">` tag containing `"SportsTeam"` is present

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wire root layout metadata through buildMetadata, add JSON-LD"
```

---

### Task 3: Split Standings page (Server metadata + `StandingsClient`)

**Files:**
- Create: `app/standings/StandingsClient.tsx`
- Create: `app/standings/StandingsClient.test.tsx` (renamed from `page.test.tsx`)
- Modify: `app/standings/page.tsx`
- Create: `app/standings/page.test.tsx` (new, replaces the old one — now tests metadata)

**Interfaces:**
- Consumes: `buildMetadata` from `lib/seo.ts` (Task 1).
- Produces: `StandingsClient` (default export, no props) — used only by the new
  `page.tsx` in this task; no other task depends on it.

- [ ] **Step 1: Move the client component**

Copy the entire current contents of `app/standings/page.tsx` into a new file
`app/standings/StandingsClient.tsx`, then change only this one line in the new file:

```diff
-export default function StandingsPage() {
+export default function StandingsClient() {
```

Everything else in the file (imports, `FormDots`, JSX, the `./page.module.css` import)
stays byte-for-byte identical.

- [ ] **Step 2: Move the existing test file onto the client component**

Copy `app/standings/page.test.tsx` to `app/standings/StandingsClient.test.tsx`. In the
new file, replace every occurrence of `StandingsPage` with `StandingsClient` (the
import line `import StandingsPage from './page';` becomes
`import StandingsClient from './StandingsClient';`, and every
`render(<StandingsPage />)` becomes `render(<StandingsClient />)`, and the
`describe('StandingsPage', ...)` block becomes `describe('StandingsClient', ...)`).

- [ ] **Step 3: Run the moved test to confirm no regression**

Run: `npx vitest run app/standings/StandingsClient.test.tsx`
Expected: PASS, same tests as the old `page.test.tsx` had.

- [ ] **Step 4: Write the failing test for the new page.tsx metadata**

Delete the old `app/standings/page.test.tsx` content and replace it with:

```tsx
// app/standings/page.test.tsx
import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Standings page metadata', () => {
  it('sets a Standings-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Standings — Glory Glory Man United');
    expect(metadata.description).toBe(
      "Manchester United's league position and cup group standings across every competition this season.",
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/standings' });
    expect(metadata.openGraph?.title).toBe('Standings — Glory Glory Man United');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: FAIL — `app/standings/page.tsx` still exports the old client component, not a
`metadata` object (or the import of `StandingsClient` inside it is now broken since it
doesn't exist as a separate export yet).

- [ ] **Step 6: Rewrite `app/standings/page.tsx` as the Server wrapper**

```tsx
// app/standings/page.tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import StandingsClient from './StandingsClient';

export const metadata: Metadata = buildMetadata({
  title: 'Standings — Glory Glory Man United',
  description: "Manchester United's league position and cup group standings across every competition this season.",
  path: '/standings',
});

export default function StandingsPage() {
  return <StandingsClient />;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions elsewhere.

- [ ] **Step 9: Commit**

```bash
git add app/standings/StandingsClient.tsx app/standings/StandingsClient.test.tsx app/standings/page.tsx app/standings/page.test.tsx
git commit -m "feat: split Standings page into Server metadata + StandingsClient"
```

---

### Task 4: Split Stats page (Server metadata + `StatsClient`)

**Files:**
- Create: `app/stats/StatsClient.tsx`
- Create: `app/stats/StatsClient.test.tsx` (renamed from `page.test.tsx`)
- Modify: `app/stats/page.tsx`
- Create: `app/stats/page.test.tsx` (new)

**Interfaces:**
- Consumes: `buildMetadata` from `lib/seo.ts` (Task 1).
- Produces: `StatsClient` (default export, no props) — used only by this task's
  `page.tsx`.

- [ ] **Step 1: Move the client component**

Copy `app/stats/page.tsx`'s entire contents into `app/stats/StatsClient.tsx`, changing
only:

```diff
-export default function StatsPage() {
+export default function StatsClient() {
```

- [ ] **Step 2: Move the existing test file**

Copy `app/stats/page.test.tsx` to `app/stats/StatsClient.test.tsx`. Replace every
occurrence of `StatsPage` with `StatsClient` (import line, every
`render(<StatsPage ... />)`, and the top-level `describe` block name).

- [ ] **Step 3: Run the moved test to confirm no regression**

Run: `npx vitest run app/stats/StatsClient.test.tsx`
Expected: PASS

- [ ] **Step 4: Write the failing test for page.tsx metadata**

```tsx
// app/stats/page.test.tsx
import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Stats page metadata', () => {
  it('sets a Stats-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Season Stats — Glory Glory Man United');
    expect(metadata.description).toBe(
      'Top scorers, assists, and season leaderboard for Manchester United across every competition.',
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/stats' });
    expect(metadata.openGraph?.title).toBe('Season Stats — Glory Glory Man United');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: FAIL — `app/stats/page.tsx` doesn't export `metadata` yet.

- [ ] **Step 6: Rewrite `app/stats/page.tsx`**

```tsx
// app/stats/page.tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import StatsClient from './StatsClient';

export const metadata: Metadata = buildMetadata({
  title: 'Season Stats — Glory Glory Man United',
  description: 'Top scorers, assists, and season leaderboard for Manchester United across every competition.',
  path: '/stats',
});

export default function StatsPage() {
  return <StatsClient />;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add app/stats/StatsClient.tsx app/stats/StatsClient.test.tsx app/stats/page.tsx app/stats/page.test.tsx
git commit -m "feat: split Stats page into Server metadata + StatsClient"
```

---

### Task 5: Split Team page (Server metadata + `TeamClient`)

**Files:**
- Create: `app/team/TeamClient.tsx`
- Create: `app/team/TeamClient.test.tsx` (renamed from `page.test.tsx`)
- Modify: `app/team/page.tsx`
- Create: `app/team/page.test.tsx` (new)

**Interfaces:**
- Consumes: `buildMetadata` from `lib/seo.ts` (Task 1).
- Produces: `TeamClient` (default export, no props) — used only by this task's
  `page.tsx`.

- [ ] **Step 1: Move the client component**

Copy `app/team/page.tsx`'s entire contents into `app/team/TeamClient.tsx`, changing
only:

```diff
-export default function TeamPage() {
+export default function TeamClient() {
```

- [ ] **Step 2: Move the existing test file**

Copy `app/team/page.test.tsx` to `app/team/TeamClient.test.tsx`. Replace every
occurrence of `TeamPage` with `TeamClient` (import line, every `render(<TeamPage />)`,
and the `describe('TeamPage', ...)` block name).

- [ ] **Step 3: Run the moved test to confirm no regression**

Run: `npx vitest run app/team/TeamClient.test.tsx`
Expected: PASS (3 tests, same as before)

- [ ] **Step 4: Write the failing test for page.tsx metadata**

```tsx
// app/team/page.test.tsx
import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Team page metadata', () => {
  it('sets a Team-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Squad — Glory Glory Man United');
    expect(metadata.description).toBe(
      "Manchester United's full first-team roster by position, with shirt numbers and nationalities.",
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/team' });
    expect(metadata.openGraph?.title).toBe('Squad — Glory Glory Man United');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run app/team/page.test.tsx`
Expected: FAIL — `app/team/page.tsx` doesn't export `metadata` yet.

- [ ] **Step 6: Rewrite `app/team/page.tsx`**

```tsx
// app/team/page.tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import TeamClient from './TeamClient';

export const metadata: Metadata = buildMetadata({
  title: 'Squad — Glory Glory Man United',
  description: "Manchester United's full first-team roster by position, with shirt numbers and nationalities.",
  path: '/team',
});

export default function TeamPage() {
  return <TeamClient />;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run app/team/page.test.tsx`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add app/team/TeamClient.tsx app/team/TeamClient.test.tsx app/team/page.tsx app/team/page.test.tsx
git commit -m "feat: split Team page into Server metadata + TeamClient"
```

---

### Task 6: Split Match detail page (`generateMetadata` + `MatchDetailClient`)

**Files:**
- Create: `app/match/[id]/MatchDetailClient.tsx`
- Create: `app/match/[id]/MatchDetailClient.test.tsx` (renamed from `page.test.tsx`)
- Modify: `app/match/[id]/page.tsx`
- Create: `app/match/[id]/page.test.tsx` (new)

**Interfaces:**
- Consumes: `buildMetadata` (`lib/seo.ts`, Task 1); `getMatches(apiKey: string): Promise<MatchesResponse>`
  (`lib/matches.ts`, existing); `fetchEspnDetail(slug: string, eventId: string): Promise<EspnDetail>`
  (`lib/espn.ts`, existing); `getCompetition(id: CompetitionId): CompetitionMapping`
  (`lib/competitions.ts`, existing, `.espnSlug: string`); `getCached`/`setCached`/`LIVE_TTL_MS`/`STATIC_TTL_MS`
  (`lib/cache.ts`, existing).
- Produces: `MatchDetailClient` (default export, no props — reads `useParams()` itself)
  — used only by this task's `page.tsx`.

This is the one route where the title is genuinely dynamic (depends on which two teams
are playing), so `generateMetadata` needs its own real logic and test coverage, unlike
Tasks 3–5's static titles.

- [ ] **Step 1: Move the client component**

Copy `app/match/[id]/page.tsx`'s entire contents into
`app/match/[id]/MatchDetailClient.tsx`, changing only:

```diff
-export default function MatchDetailPage() {
+export default function MatchDetailClient() {
```

- [ ] **Step 2: Move the existing test file**

Copy `app/match/[id]/page.test.tsx` to `app/match/[id]/MatchDetailClient.test.tsx`.
Replace every occurrence of `MatchDetailPage` with `MatchDetailClient` (the import line
`import MatchDetailPage from './page';` becomes
`import MatchDetailClient from './MatchDetailClient';`, and every
`render(<MatchDetailPage />)` becomes `render(<MatchDetailClient />)`; the
`vi.mock('next/navigation', ...)` block and `describe('MatchDetailPage', ...)` name stay
as `MatchDetailPage`→`MatchDetailClient` too for the describe block).

- [ ] **Step 3: Run the moved test to confirm no regression**

Run: `npx vitest run "app/match/[id]/MatchDetailClient.test.tsx"`
Expected: PASS, same tests as the old `page.test.tsx` had.

- [ ] **Step 4: Write the failing tests for `generateMetadata`**

```tsx
// app/match/[id]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from '@/lib/cache';
import type { Match } from '@/lib/types';

vi.mock('@/lib/matches', () => ({ getMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnDetail: vi.fn() }));

import { getMatches } from '@/lib/matches';
import { fetchEspnDetail } from '@/lib/espn';
import { generateMetadata } from './page';

const mockGetMatches = vi.mocked(getMatches);
const mockFetchDetail = vi.mocked(fetchEspnDetail);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '2026-08-16_arsenal',
    utcDate: '2026-08-16T14:00Z',
    status: 'SCHEDULED',
    competition: 'PL',
    home: { name: 'Manchester United' },
    away: { name: 'Arsenal' },
    venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { espn: '401963531' },
    ...overrides,
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('Match detail generateMetadata', () => {
  it('builds a "Home vs Away" title once ESPN detail resolves', async () => {
    mockGetMatches.mockResolvedValue({
      season: '2026-27',
      matches: [makeMatch()],
      meta: { sources: { fd: true, espn: true } },
    });
    mockFetchDetail.mockResolvedValue({
      header: {
        competitions: [{
          status: { type: { state: 'pre' } },
          competitors: [
            { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
            { homeAway: 'away', team: { id: '359', displayName: 'Arsenal' } },
          ],
        }],
      },
    });

    const result = await generateMetadata({ params: Promise.resolve({ id: '2026-08-16_arsenal' }) });

    expect(result.title).toBe('Manchester United vs Arsenal — Glory Glory Man United');
    expect(result.description).toBe('Live score, lineups, stats and match events for Manchester United vs Arsenal.');
    expect(mockFetchDetail).toHaveBeenCalledWith('eng.1', '401963531');
  });

  it('falls back to a generic title when the match id is not found', async () => {
    mockGetMatches.mockResolvedValue({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } });

    const result = await generateMetadata({ params: Promise.resolve({ id: 'does-not-exist' }) });

    expect(result.title).toBe('Match Detail — Glory Glory Man United');
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('falls back to a generic title when the match has no ESPN source', async () => {
    mockGetMatches.mockResolvedValue({
      season: '2026-27',
      matches: [makeMatch({ sources: {} })],
      meta: { sources: { fd: true, espn: false } },
    });

    const result = await generateMetadata({ params: Promise.resolve({ id: '2026-08-16_arsenal' }) });

    expect(result.title).toBe('Match Detail — Glory Glory Man United');
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run "app/match/[id]/page.test.tsx"`
Expected: FAIL — `app/match/[id]/page.tsx` doesn't export `generateMetadata` yet.

- [ ] **Step 6: Rewrite `app/match/[id]/page.tsx`**

```tsx
// app/match/[id]/page.tsx
import type { Metadata } from 'next';
import { getMatches } from '@/lib/matches';
import { fetchEspnDetail } from '@/lib/espn';
import { getCompetition } from '@/lib/competitions';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import { buildMetadata, SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/seo';
import type { EspnDetail } from '@/lib/types';
import MatchDetailClient from './MatchDetailClient';

function fallbackMetadata(id: string): Metadata {
  return buildMetadata({
    title: `Match Detail — ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    path: `/match/${id}`,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  // Mirrors app/api/match/[id]/route.ts's own lookup: the app's own match id is
  // resolved to an ESPN event id + competition slug server-side.
  const matchesResponse = await getMatches(process.env.FOOTBALL_API_KEY || '');
  const match = matchesResponse.matches.find(m => m.id === id);
  if (!match || !match.sources.espn) return fallbackMetadata(id);

  const slug = getCompetition(match.competition).espnSlug;
  // Same cache key as the route handler (app/api/match/[id]/route.ts) — populating it
  // here means MatchDetailClient's own fetch-on-mount hits a warm cache instead of
  // triggering a second live request for the same match.
  const cacheKey = `match-detail:${id}`;
  let detail = getCached<EspnDetail>(cacheKey);
  if (!detail) {
    detail = await fetchEspnDetail(slug, match.sources.espn);
    const state = detail.header?.competitions?.[0]?.status?.type?.state;
    setCached(cacheKey, detail, state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS);
  }

  const headerComp = detail.header?.competitions?.[0];
  const home = headerComp?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName;
  const away = headerComp?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName;
  if (!home || !away) return fallbackMetadata(id);

  return buildMetadata({
    title: `${home} vs ${away} — ${SITE_NAME}`,
    description: `Live score, lineups, stats and match events for ${home} vs ${away}.`,
    path: `/match/${id}`,
  });
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
```

Note: the title deliberately uses each team's raw `team.displayName` (e.g. "Manchester
United"), not the UI's `displayTeamName()` helper (which renders MU as "Red Devils" for
on-page display) — search and share previews should show the official club name, not
the site's in-app nickname.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run "app/match/[id]/page.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add "app/match/[id]/MatchDetailClient.tsx" "app/match/[id]/MatchDetailClient.test.tsx" "app/match/[id]/page.tsx" "app/match/[id]/page.test.tsx"
git commit -m "feat: split Match detail page into generateMetadata + MatchDetailClient"
```

---

### Task 7: `app/sitemap.ts`

**Files:**
- Create: `app/sitemap.ts`
- Test: `app/sitemap.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from `lib/seo.ts` (Task 1).
- Produces: default-exported `sitemap(): MetadataRoute.Sitemap` — Next.js's own
  file-convention router calls this to serve `/sitemap.xml`; no other task depends on
  it directly.

- [ ] **Step 1: Write the failing test**

```ts
// app/sitemap.test.ts
import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';
import { SITE_URL } from '@/lib/seo';

describe('sitemap', () => {
  it('lists exactly the 4 static routes', () => {
    const entries = sitemap();
    expect(entries.map(e => e.url)).toEqual([
      SITE_URL,
      `${SITE_URL}/standings`,
      `${SITE_URL}/stats`,
      `${SITE_URL}/team`,
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/sitemap.test.ts`
Expected: FAIL — `app/sitemap.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/standings', '/stats', '/team'].map(path => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/sitemap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts app/sitemap.test.ts
git commit -m "feat: add sitemap.xml for the 4 static routes"
```

---

### Task 8: `app/robots.ts`

**Files:**
- Create: `app/robots.ts`
- Test: `app/robots.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from `lib/seo.ts` (Task 1).
- Produces: default-exported `robots(): MetadataRoute.Robots` — serves `/robots.txt`.

- [ ] **Step 1: Write the failing test**

```ts
// app/robots.test.ts
import { describe, it, expect } from 'vitest';
import robots from './robots';
import { SITE_URL } from '@/lib/seo';

describe('robots', () => {
  it('allows all crawlers and points at the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: `${SITE_URL}/sitemap.xml`,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/robots.test.ts`
Expected: FAIL — `app/robots.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// app/robots.ts
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/robots.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite one last time**

Run: `npm test`
Expected: PASS — every test in the project, including all tasks above.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/robots.ts app/robots.test.ts
git commit -m "feat: add robots.txt pointing at sitemap.xml"
```

---

## Manual verification (after all tasks)

Run `npm run dev` and for each of `/`, `/standings`, `/stats`, `/team`, and one
`/match/[id]` URL, view page source and confirm `<title>`, `og:title`, `og:description`,
`og:image`, and `twitter:card` are present and route-specific (except `/`, which uses
the site default). Then check `http://localhost:3000/sitemap.xml` and
`http://localhost:3000/robots.txt` render correctly.
