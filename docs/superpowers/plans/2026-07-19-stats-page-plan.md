# Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/stats` page showing Manchester United's season overview (Played, W-D-L, Goals For/Against, Goal Difference) per competition, computed entirely from data `/api/matches` already returns — no new API calls, no new external data source.

**Architecture:** One new pure function (`lib/seasonStats.ts`) that reduces the already-fetched `Match[]` into a single stats tally, reusing `matchResult()` from `lib/result.ts` (the same W/D/L helper `lib/standings.ts`'s `recentForm()` already uses). One new page (`app/stats/page.tsx`) that fetches via the existing `usePolling` + client-cache pattern (sharing the `'matches'` cache key with Today/Schedule/Standings — same endpoint, same data, so a tab switch into Stats after visiting any of those three renders instantly), with a local competition-tab filter identical in shape to Schedule's. One new nav link in `app/layout.tsx`.

**Tech Stack:** Next.js App Router, React 19 (client components), TypeScript, CSS Modules, Vitest + React Testing Library — matches every other page in this codebase, no new dependencies.

## Global Constraints

- No new npm dependencies.
- Design tokens: consume existing `var(--mu-*)`/`var(--font-*)` custom properties from `app/globals.css`; never hardcode a color that already has a token.
- Season overview only (per the brainstorm this plan resumes, recorded in `BACKLOG.md`): Played, W-D-L, Goals For/Against, Goal Difference. Explicitly **out of scope**: top scorer/card leaderboards, head-to-head history, home/away split, Fergie Time counts.
- Only count `status === 'FINISHED'` matches — a scheduled/live/postponed match has no result to tally yet.
- Run `npm test` and `npm run typecheck` after every task. Run `npm run build` after Task 3 (the task that adds a new route).
- Every commit message follows this repo's existing style (`feat:`/`fix:` + one-line summary, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).

---

### Task 1: `computeSeasonStats` in `lib/seasonStats.ts`

**Files:**
- Create: `lib/seasonStats.ts`
- Test: `lib/seasonStats.test.ts`

**Interfaces:**
- Consumes: `Match` and `CompetitionId` from `lib/types.ts`; `matchResult` from `lib/result.ts` (signature: `matchResult(m: Match): 'W' | 'D' | 'L' | null`).
- Produces: `export interface SeasonStats { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number }` and `export function computeSeasonStats(matches: Match[], competition: CompetitionId | 'ALL'): SeasonStats` — consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `lib/seasonStats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeSeasonStats } from './seasonStats';
import type { Match } from './types';

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'x',
    utcDate: '2026-08-22T11:30:00Z',
    status: 'FINISHED',
    competition: 'PL',
    home: { name: 'Hull City AFC' },
    away: { name: 'Manchester United FC' },
    venue: 'A',
    score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } },
    sources: { fd: 1 },
    ...overrides,
  };
}

describe('computeSeasonStats', () => {
  it('tallies a win, a draw, and a loss across three finished matches', () => {
    const matches: Match[] = [
      // Away win: MU (away) 2, Hull (home) 1 -> W
      match({ id: 'a', venue: 'A', score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } } }),
      // Home draw: MU (home) 1, opponent (away) 1 -> D
      match({ id: 'b', venue: 'H', score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } } }),
      // Home loss: MU (home) 0, opponent (away) 3 -> L
      match({ id: 'c', venue: 'H', score: { fullTime: { home: 0, away: 3 }, display: { home: 0, away: 3 } } }),
    ];

    const result = computeSeasonStats(matches, 'PL');

    expect(result).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 2 + 1 + 0,
      goalsAgainst: 1 + 1 + 3,
      goalDifference: (2 + 1 + 0) - (1 + 1 + 3),
    });
  });

  it('excludes matches that are not FINISHED', () => {
    const matches: Match[] = [
      match({ id: 'a', status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } }),
      match({ id: 'b', status: 'IN_PLAY', score: { fullTime: { home: 1, away: 0 }, display: { home: 1, away: 0 } } }),
      match({ id: 'c', status: 'FINISHED' }),
    ];

    expect(computeSeasonStats(matches, 'PL').played).toBe(1);
  });

  it('filters to the given competition', () => {
    const matches: Match[] = [
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL' }),
    ];

    expect(computeSeasonStats(matches, 'PL').played).toBe(1);
    expect(computeSeasonStats(matches, 'CL').played).toBe(1);
  });

  it('aggregates every competition when given ALL', () => {
    const matches: Match[] = [
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL' }),
      match({ id: 'c', competition: 'FA' }),
    ];

    expect(computeSeasonStats(matches, 'ALL').played).toBe(3);
  });

  it('returns all zeros for a competition with no finished matches yet', () => {
    const matches: Match[] = [match({ status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } })];

    expect(computeSeasonStats(matches, 'PL')).toEqual({
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/seasonStats.test.ts`
Expected: FAIL — `Cannot find module './seasonStats'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `lib/seasonStats.ts`**

```typescript
import type { CompetitionId, Match } from './types';
import { matchResult } from './result';

export interface SeasonStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

// MU's own season tally, from MU's perspective (venue-aware, same as matchResult and
// lib/standings.ts's recentForm — muScore/oppScore depend on which side MU played on,
// not literal home/away). 'ALL' aggregates every competition; anything else filters to
// just that one.
export function computeSeasonStats(matches: Match[], competition: CompetitionId | 'ALL'): SeasonStats {
  const stats: SeasonStats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    if (competition !== 'ALL' && m.competition !== competition) continue;

    const result = matchResult(m);
    if (result === null) continue; // defensive: FINISHED but missing a score

    const muScore = m.venue === 'H' ? m.score.display.home : m.score.display.away;
    const oppScore = m.venue === 'H' ? m.score.display.away : m.score.display.home;

    stats.played += 1;
    if (result === 'W') stats.won += 1;
    else if (result === 'D') stats.drawn += 1;
    else stats.lost += 1;
    stats.goalsFor += muScore ?? 0;
    stats.goalsAgainst += oppScore ?? 0;
  }

  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  return stats;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/seasonStats.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/seasonStats.ts lib/seasonStats.test.ts
git commit -m "feat: add computeSeasonStats for the upcoming Stats page"
```

---

### Task 2: `/stats` page

**Files:**
- Create: `app/stats/page.tsx`
- Create: `app/stats/page.module.css`
- Test: `app/stats/page.test.tsx`

**Interfaces:**
- Consumes: `computeSeasonStats`/`SeasonStats` from `lib/seasonStats.ts` (Task 1); `usePolling` from `hooks/usePolling.ts` (signature: `usePolling<T>(fetcher: () => Promise<T>, intervalMs: number | null, cache?: { key: string; ttlMs: number | ((result: T) => number) }): { data: T | null; error: Error | null; loading: boolean; refetch: () => void }`); `LIVE_TTL_MS` from `lib/cache.ts`; `MatchesResponse`/`CompetitionId` from `lib/types.ts`; `COMPETITIONS`/`getCompetition` from `lib/competitions.ts`; `PageHeading` from `components/PageHeading.tsx` (props: `{ title: string; onRefresh?: () => void; refreshing?: boolean }`); `LoadingSpinner` from `components/LoadingSpinner.tsx`.
- Produces: the `/stats` route, rendered at `data-testid="stats-page"` on its `<main>`. Not consumed by any other task in this plan — Task 3 only links to the route by path, not by import.

- [ ] **Step 1: Write the failing tests**

Create `app/stats/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import StatsPage from './page';
import { clearCache } from '@/lib/cache';
import type { Match, MatchesResponse } from '@/lib/types';

// usePolling's client cache is a module-level Map shared across every test in this file
// (and with app/page.test.tsx / app/schedule/page.test.tsx, which use the same
// 'matches' cache key) — clear it so each test starts from a real fetch.
beforeEach(() => clearCache());
afterEach(() => vi.unstubAllGlobals());

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'x',
    utcDate: '2026-08-22T11:30:00Z',
    status: 'FINISHED',
    competition: 'PL',
    home: { name: 'Hull City AFC' },
    away: { name: 'Manchester United FC' },
    venue: 'A',
    score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } },
    sources: { fd: 1 },
    ...overrides,
  };
}

function stubMatches(matches: Match[]) {
  const response: MatchesResponse = { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
}

describe('StatsPage', () => {
  it('shows a loading state before the first fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<StatsPage />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows the ALL-competition tally by default', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL', venue: 'A', score: { fullTime: { home: 1, away: 2 }, display: { home: 1, away: 2 } } }),
      match({ id: 'b', competition: 'CL', venue: 'H', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } } }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('tab', { name: 'ALL', selected: true })).toBeInTheDocument();
    expect(screen.getByTestId('stat-played')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-won')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-drawn')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalsFor')).toHaveTextContent('2');
    // Match a: venue A, score home:1/away:2 -> muScore=2 (away), oppScore=1 (home).
    // Match b: venue H, score home:0/away:0 -> muScore=0, oppScore=0.
    // GA = 1 + 0 = 1, GD = GF(2) - GA(1) = 1.
    expect(screen.getByTestId('stat-goalsAgainst')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalDifference')).toHaveTextContent('1');
  });

  it('filters to one competition when its tab is clicked', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'CL', score: { fullTime: { home: 5, away: 5 }, display: { home: 5, away: 5 } } }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('tab', { name: 'PL' }));
    expect(screen.getByTestId('stat-played')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-goalsFor')).toHaveTextContent('2');
  });

  it('shows an empty state when the selected competition has no finished matches yet', async () => {
    stubMatches([match({ competition: 'PL', status: 'SCHEDULED', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } } })]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/no finished matches yet/i)).toBeInTheDocument();
  });

  it('refetches when the Refresh button is clicked', async () => {
    stubMatches([match()]);
    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ season: '2026-27', matches: [match(), match({ id: 'b' })], meta: { sources: { fd: true, espn: true } } }) });
    vi.stubGlobal('fetch', fetchMock);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await act(async () => { await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByTestId('stat-played')).toHaveTextContent('2');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: FAIL — `Cannot find module './page'` (the page doesn't exist yet).

- [ ] **Step 3: Implement `app/stats/page.module.css`**

```css
.main {
  padding: 14px 1.5rem 1.5rem;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tab {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  border: 1px solid rgba(201, 162, 39, 0.3);
  border-radius: 2px;
  background: transparent;
  color: var(--mu-gold);
  cursor: pointer;
}

.tab[aria-selected="true"] {
  border-color: var(--mu-red);
  background: rgba(218, 41, 28, 0.15);
  color: var(--mu-white);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 10px;
}

.tile {
  padding: 14px 10px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(201, 162, 39, 0.3);
  border-radius: 3px;
  text-align: center;
}

.tileValue {
  display: block;
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  color: var(--mu-white);
}

.tileLabel {
  display: block;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
}

.won .tileValue { color: var(--mu-green); }
.drawn .tileValue { color: var(--mu-gold); }
.lost .tileValue { color: var(--mu-red); }
```

- [ ] **Step 4: Implement `app/stats/page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { COMPETITIONS } from '@/lib/competitions';
import { computeSeasonStats } from '@/lib/seasonStats';
import { usePolling } from '@/hooks/usePolling';
import { LIVE_TTL_MS } from '@/lib/cache';
import { PageHeading } from '@/components/PageHeading';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import styles from './page.module.css';

type FilterValue = CompetitionId | 'ALL';

async function fetchMatches(): Promise<MatchesResponse> {
  const res = await fetch('/api/matches');
  if (!res.ok) throw new Error('Failed to load matches');
  return res.json();
}

export default function StatsPage() {
  const [selected, setSelected] = useState<FilterValue>('ALL');
  // Same 'matches' cache key as Today/Schedule/Standings — same endpoint, same data, so
  // arriving here after visiting any of those three renders instantly instead of
  // re-fetching (see hooks/usePolling.ts's client-cache doc comment for why).
  const { data, loading, refetch } = usePolling(fetchMatches, null, { key: 'matches', ttlMs: LIVE_TTL_MS });

  if (!data) return <LoadingSpinner />;

  const stats = computeSeasonStats(data.matches, selected);

  return (
    <main className={styles.main} data-testid="stats-page">
      <PageHeading title="Stats" onRefresh={refetch} refreshing={loading} />
      <div role="tablist" className={styles.tabs}>
        <button role="tab" aria-selected={selected === 'ALL'} onClick={() => setSelected('ALL')} className={styles.tab}>ALL</button>
        {COMPETITIONS.map(c => (
          <button key={c.id} role="tab" aria-selected={selected === c.id} onClick={() => setSelected(c.id)} className={styles.tab}>
            {c.navShortLabel}
          </button>
        ))}
      </div>
      {stats.played === 0 ? (
        <p>No finished matches yet for this competition</p>
      ) : (
        <div className={styles.grid}>
          <div className={styles.tile}>
            <span className={styles.tileValue} data-testid="stat-played">{stats.played}</span>
            <span className={styles.tileLabel}>Played</span>
          </div>
          <div className={`${styles.tile} ${styles.won}`}>
            <span className={styles.tileValue} data-testid="stat-won">{stats.won}</span>
            <span className={styles.tileLabel}>Won</span>
          </div>
          <div className={`${styles.tile} ${styles.drawn}`}>
            <span className={styles.tileValue} data-testid="stat-drawn">{stats.drawn}</span>
            <span className={styles.tileLabel}>Drawn</span>
          </div>
          <div className={`${styles.tile} ${styles.lost}`}>
            <span className={styles.tileValue} data-testid="stat-lost">{stats.lost}</span>
            <span className={styles.tileLabel}>Lost</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue} data-testid="stat-goalsFor">{stats.goalsFor}</span>
            <span className={styles.tileLabel}>Goals For</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue} data-testid="stat-goalsAgainst">{stats.goalsAgainst}</span>
            <span className={styles.tileLabel}>Goals Against</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue} data-testid="stat-goalDifference">{stats.goalDifference}</span>
            <span className={styles.tileLabel}>Goal Difference</span>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors (confirms the new page didn't break any shared module).

- [ ] **Step 7: Commit**

```bash
git add app/stats/page.tsx app/stats/page.module.css app/stats/page.test.tsx
git commit -m "feat: add /stats page with season overview by competition"
```

---

### Task 3: Nav link

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing new (plain `next/link` `<Link>`, already imported in this file).
- Produces: nothing consumed elsewhere — this is the final task.

- [ ] **Step 1: Add the nav link**

In `app/layout.tsx`, the `<nav>` block currently reads:

```tsx
<nav className={styles.nav}>
  <Link href="/">Today</Link>
  <Link href="/schedule">Schedule</Link>
  <Link href="/standings">Standings</Link>
  <span className={styles.chant}>Glory Glory Man United</span>
</nav>
```

Change it to:

```tsx
<nav className={styles.nav}>
  <Link href="/">Today</Link>
  <Link href="/schedule">Schedule</Link>
  <Link href="/standings">Standings</Link>
  <Link href="/stats">Stats</Link>
  <span className={styles.chant}>Glory Glory Man United</span>
</nav>
```

- [ ] **Step 2: Run the full suite, typecheck, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: PASS; build output lists `/stats` as a new static route alongside `/`, `/schedule`, `/standings`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: link the new Stats page from the nav"
```

---

## Self-Review Notes

- **Spec coverage:** BACKLOG.md's four bullets are covered — new page + own nav link (Task 2, Task 3), local tab filter matching Schedule's pattern (Task 2), season-overview-only stat set computed from `Match[]` with no new API calls (Task 1), and reuse of `matchResult()` (Task 1, same as `recentForm()`). Out-of-scope items (leaderboards, head-to-head, home/away split, Fergie Time) are named explicitly in Global Constraints so no task accidentally drifts into them.
- **Placeholder scan:** none — every step has complete, runnable code.
- **Type consistency:** `SeasonStats` (Task 1) fields (`played`, `won`, `drawn`, `lost`, `goalsFor`, `goalsAgainst`, `goalDifference`) match the `data-testid`s and property accesses used in Task 2's page and tests. `computeSeasonStats(matches: Match[], competition: CompetitionId | 'ALL')`'s signature matches every call site.
