# Season Leaders (Top Scorer/Assist/Yellow Card) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Season Leaders" section to the `/stats` page showing MU's Top 5 Scorers, Top 5 Assists, and Top 5 Yellow Cards across all competitions this season (Friendlies excluded, matching the Stats page's existing scope), aggregated from ESPN's per-match detail data.

**Architecture:** This data doesn't exist anywhere the app already fetches — `/api/matches` only has match-level scores/status, not per-player goal/assist/card events. Those live in ESPN's `/summary` detail endpoint (`fetchEspnDetail`, already used by the match-detail page), one call per match. A new server route (`app/api/leaders/route.ts`) fetches every FINISHED, non-friendly match's detail in parallel (`Promise.allSettled`, tolerating individual failures the same way `/api/matches` already does), extracts each match's MU-side goals/assists/yellow-cards via a new pure module (`lib/leaders.ts`), tallies them across the season, and caches the result for hours (not seconds — this changes only when a match finishes, unlike live scores). The `/stats` page fetches this route the same way it fetches `/api/matches`: `usePolling` + the existing client cache module.

**Tech Stack:** Next.js Route Handlers, TypeScript, Vitest — no new dependencies, matches every other API route and page in this codebase.

## Global Constraints

- No new npm dependencies.
- Aggregate across **all competitions except FRIENDLY** — same exclusion the Stats page's W-D-L tiles already apply, for the same reason (season leaders is a competitive-record view).
- Show **Top 5** per category. Ties broken alphabetically by player name (stable, deterministic — avoids the list order changing between identical requests for no visible reason).
- **Own goals do not count as a goal or an assist for anyone on MU's side.** An own-goal event credited to MU's team ID (`ownGoal: true`) was scored by an *opposing* player into their own net — crediting that name to "MU's top scorer" would attribute an opponent's own goal to a Red Devil. Exclude `ownGoal` events entirely from both goals and assists extraction.
- Cache the aggregated result for **6 hours** (`LEADERS_TTL_MS`, new constant in `lib/cache.ts`) — this is fetched lazily (first visitor after the cache expires waits for the full fetch-all-matches-details pass; everyone after that gets the cached result instantly), not on a schedule. No new infrastructure (cron, background jobs) — matches every other cache in this codebase (`lib/cache.ts`'s existing module-level `Map`).
- Run `npm test` and `npm run typecheck` after every task; run `npm run build` after the final task.
- Every commit message follows this repo's existing style (`feat:`/`fix:` + one-line summary, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).

## Verified ESPN Data Shapes (checked live 2026-07-19, same `/summary` endpoint `fetchEspnDetail` already uses)

- Goals: `detail.header.competitions[0].details[]`, entries with `scoringPlay: true`. `participants[0].athlete.displayName` is the scorer; `participants[1].athlete.displayName` (when present — not every goal has one, e.g. many penalties) is the assist provider. `ownGoal: true` marks an own goal (see constraint above).
- Yellow cards: **not** in `details` — that array is scoring-plays-only in practice (verified: a real finished match had 3 `details` entries, all `scoringPlay: true`, zero cards, despite the match having cards). Cards live in `detail.keyEvents[]`, entries with `type.type === 'yellow-card'` (`type.text === 'Yellow Card'`). `participants[0].athlete.displayName` is the carded player. `team.id` on both `details` and `keyEvents` entries is the ESPN team ID of the side the event is attributed to.
- MU's ESPN team ID is `360`, currently a private `const MU_ESPN_ID` in `lib/espn.ts` — Task 1 exports it for reuse.

---

### Task 1: `lib/leaders.ts` — per-match extraction and season tally

**Files:**
- Modify: `lib/espn.ts` (export `MU_ESPN_ID`)
- Modify: `lib/types.ts` (add `PlayerTally`, `SeasonLeaders`; add `keyEvents`/`ownGoal` fields already present on `EspnDetail`/`EspnScoringDetail` — check first, `EspnDetail.keyEvents` and `EspnScoringDetail.ownGoal` already exist from the match-detail-stats work, no change needed if so)
- Create: `lib/leaders.ts`
- Test: `lib/leaders.test.ts`

**Interfaces:**
- Consumes: `EspnDetail`, `EspnScoringDetail`, `EspnKeyEvent` from `lib/types.ts` (already defined — check `lib/types.ts` before writing, these were added for the match-detail stats/subs/shootout feature; do not redefine, import as-is).
- Produces: `export interface PlayerTally { name: string; count: number }`, `export interface SeasonLeaders { topScorers: PlayerTally[]; topAssists: PlayerTally[]; topYellowCards: PlayerTally[] }` in `lib/types.ts`; `export function extractMatchContributions(detail: EspnDetail, muEspnId: string): { goals: string[]; assists: string[]; yellowCards: string[] }` and `export function tallyLeaders(perMatch: Array<{ goals: string[]; assists: string[]; yellowCards: string[] }>, topN?: number): SeasonLeaders` from `lib/leaders.ts` — both consumed by Task 2 (the API route).
- `export const MU_ESPN_ID = 360;` from `lib/espn.ts` (was a private `const`, now exported) — consumed by Task 2.

- [ ] **Step 1: Read `lib/types.ts` to confirm what already exists**

Run: `grep -n "EspnKeyEvent\|EspnScoringDetail\|ownGoal\|keyEvents" lib/types.ts`

`EspnScoringDetail` should already have `ownGoal?: boolean`, `scoringPlay?: boolean`, `shootout?: boolean`, `team?: { id?: string }`, `participants?: Array<{ athlete?: { displayName?: string } }>`. `EspnKeyEvent` should already have `type?: { type?: string }`, `team?: { id?: string }`, `participants?: Array<{ athlete?: { displayName?: string } }>`. `EspnDetail` should already have `keyEvents?: EspnKeyEvent[]` and `header.competitions[0].details?: EspnScoringDetail[]`. These were added in an earlier session for the match-detail page's stats/subs/shootout sections — if any are missing, add them matching this exact shape before continuing; if all present, this step is a no-op confirmation, not a code change.

- [ ] **Step 2: Export `MU_ESPN_ID` from `lib/espn.ts`**

In `lib/espn.ts`, change:

```typescript
const MU_ESPN_ID = 360;
```

to:

```typescript
export const MU_ESPN_ID = 360;
```

No other change to this file.

- [ ] **Step 3: Add `PlayerTally`/`SeasonLeaders` to `lib/types.ts`**

Add near `Scorers`/`Substitution`/`MatchStatRow`/`ShootoutSummary` (this file's other small result-shape interfaces):

```typescript
export interface PlayerTally {
  name: string;
  count: number;
}

export interface SeasonLeaders {
  topScorers: PlayerTally[];
  topAssists: PlayerTally[];
  topYellowCards: PlayerTally[];
}
```

- [ ] **Step 4: Write the failing tests**

Create `lib/leaders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractMatchContributions, tallyLeaders } from './leaders';
import type { EspnDetail } from './types';

const MU = '360';
const OPPONENT = '331';

function detail(overrides: Partial<EspnDetail> = {}): EspnDetail {
  return {
    header: { competitions: [{ status: { type: { state: 'post' } } }] },
    ...overrides,
  };
}

describe('extractMatchContributions', () => {
  it('extracts MU goals and their assists, ignoring the opponent\'s', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }, { athlete: { displayName: 'Amad Diallo' } }] },
            { scoringPlay: true, team: { id: OPPONENT }, participants: [{ athlete: { displayName: 'Opponent Striker' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual(['Bruno Fernandes']);
    expect(result.assists).toEqual(['Amad Diallo']);
  });

  it('does not credit an assist when a goal has no second participant (e.g. many penalties)', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, penaltyKick: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual(['Bruno Fernandes']);
    expect(result.assists).toEqual([]);
  });

  it('excludes own goals from both goals and assists, even when credited to MU\'s team id', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            // An opponent's own goal is scored BY the opponent but credited (team.id)
            // to MU, since MU benefits from it — must not appear as a MU player's goal.
            { scoringPlay: true, ownGoal: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Opponent Defender' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual([]);
    expect(result.assists).toEqual([]);
  });

  it('excludes shootout goals (they are not run-of-play goals)', () => {
    const d = detail({
      header: {
        competitions: [{
          status: { type: { state: 'post' } },
          details: [
            { scoringPlay: true, shootout: true, team: { id: MU }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }] },
          ],
        }],
      },
    });

    const result = extractMatchContributions(d, MU);
    expect(result.goals).toEqual([]);
  });

  it('extracts MU yellow cards from keyEvents, ignoring the opponent\'s and other event types', () => {
    const d = detail({
      keyEvents: [
        { type: { type: 'yellow-card' }, team: { id: MU }, participants: [{ athlete: { displayName: 'Casemiro' } }] },
        { type: { type: 'yellow-card' }, team: { id: OPPONENT }, participants: [{ athlete: { displayName: 'Opponent Midfielder' } }] },
        { type: { type: 'substitution' }, team: { id: MU }, participants: [{ athlete: { displayName: 'Amad Diallo' } }, { athlete: { displayName: 'Antony' } }] },
      ],
    });

    const result = extractMatchContributions(d, MU);
    expect(result.yellowCards).toEqual(['Casemiro']);
  });

  it('returns empty arrays for a match with no details or keyEvents at all', () => {
    const result = extractMatchContributions(detail(), MU);
    expect(result).toEqual({ goals: [], assists: [], yellowCards: [] });
  });
});

describe('tallyLeaders', () => {
  it('counts occurrences across matches and sorts descending', () => {
    const perMatch = [
      { goals: ['Bruno Fernandes', 'Amad Diallo'], assists: ['Antony'], yellowCards: [] },
      { goals: ['Bruno Fernandes'], assists: ['Antony'], yellowCards: ['Casemiro'] },
    ];

    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toEqual([
      { name: 'Bruno Fernandes', count: 2 },
      { name: 'Amad Diallo', count: 1 },
    ]);
    expect(result.topAssists).toEqual([{ name: 'Antony', count: 2 }]);
    expect(result.topYellowCards).toEqual([{ name: 'Casemiro', count: 1 }]);
  });

  it('breaks ties alphabetically by name', () => {
    const perMatch = [{ goals: ['Zidane', 'Amad'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toEqual([
      { name: 'Amad', count: 1 },
      { name: 'Zidane', count: 1 },
    ]);
  });

  it('caps each list at topN (default 5)', () => {
    const perMatch = [{ goals: ['A', 'B', 'C', 'D', 'E', 'F'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch);
    expect(result.topScorers).toHaveLength(5);
  });

  it('accepts a custom topN', () => {
    const perMatch = [{ goals: ['A', 'B', 'C'], assists: [], yellowCards: [] }];
    const result = tallyLeaders(perMatch, 2);
    expect(result.topScorers).toHaveLength(2);
  });

  it('returns empty lists for no matches', () => {
    expect(tallyLeaders([])).toEqual({ topScorers: [], topAssists: [], topYellowCards: [] });
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run lib/leaders.test.ts`
Expected: FAIL — `Cannot find module './leaders'`.

- [ ] **Step 6: Implement `lib/leaders.ts`**

```typescript
import type { EspnDetail, PlayerTally, SeasonLeaders } from './types';

// Goals/assists come from header.competitions[0].details (scoring plays only — verified
// live: a real finished match's `details` array held exactly its 3 goals and nothing
// else, no cards). Cards come from keyEvents instead (verified: the same match's one
// yellow card appeared there, not in `details`) — see this plan's "Verified ESPN Data
// Shapes" section for the full write-up.
export function extractMatchContributions(
  detail: EspnDetail,
  muEspnId: string,
): { goals: string[]; assists: string[]; yellowCards: string[] } {
  const details = detail.header.competitions[0]?.details || [];
  // Own goals are excluded entirely: an own-goal event's team.id is the side that
  // BENEFITS (i.e. MU, if it happened to fall MU's way), but participants[0] is the
  // OPPOSING player who put it into their own net — crediting that name to MU's
  // scorer/assist board would attribute an opponent's mistake to a Red Devil.
  const muGoals = details.filter(d => d.scoringPlay && !d.shootout && !d.ownGoal && d.team?.id === muEspnId);

  const goals = muGoals
    .map(g => g.participants?.[0]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));
  const assists = muGoals
    .map(g => g.participants?.[1]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));

  const yellowCards = (detail.keyEvents || [])
    .filter(e => e.type?.type === 'yellow-card' && e.team?.id === muEspnId)
    .map(e => e.participants?.[0]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));

  return { goals, assists, yellowCards };
}

function tally(names: string[], topN: number): PlayerTally[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, topN);
}

export function tallyLeaders(
  perMatch: Array<{ goals: string[]; assists: string[]; yellowCards: string[] }>,
  topN = 5,
): SeasonLeaders {
  return {
    topScorers: tally(perMatch.flatMap(m => m.goals), topN),
    topAssists: tally(perMatch.flatMap(m => m.assists), topN),
    topYellowCards: tally(perMatch.flatMap(m => m.yellowCards), topN),
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run lib/leaders.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add lib/espn.ts lib/types.ts lib/leaders.ts lib/leaders.test.ts
git commit -m "feat: add lib/leaders.ts to extract and tally MU goals/assists/cards"
```

---

### Task 2: `app/api/leaders/route.ts`

**Files:**
- Modify: `lib/cache.ts` (add `LEADERS_TTL_MS`)
- Create: `app/api/leaders/route.ts`
- Test: `app/api/leaders/route.test.ts`

**Interfaces:**
- Consumes: `fetchMuMatches` from `lib/fd.ts`; `fetchEspnSchedule`, `fetchEspnDetail`, `MU_ESPN_ID` from `lib/espn.ts` (Task 1 exported the last one); `mergeMatches` from `lib/merge.ts`; `extractMatchContributions`, `tallyLeaders` from `lib/leaders.ts` (Task 1); `getCached`, `setCached` from `lib/cache.ts`; `COMPETITIONS`, `getCompetition` from `lib/competitions.ts`; `CompetitionId`, `EspnScheduleEvent`, `FdMatch`, `SeasonLeaders` from `lib/types.ts`.
- Produces: `GET /api/leaders` returning `SeasonLeaders` JSON — consumed by Task 3 (the `/stats` page).

- [ ] **Step 1: Add `LEADERS_TTL_MS` to `lib/cache.ts`**

In `lib/cache.ts`, alongside the existing `LIVE_TTL_MS`/`STATIC_TTL_MS`:

```typescript
export const LIVE_TTL_MS = 30_000;
export const STATIC_TTL_MS = 300_000;
export const LEADERS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — see plan's Global Constraints
```

- [ ] **Step 2: Write the failing tests**

Create `app/api/leaders/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchMuMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnSchedule: vi.fn(), fetchEspnDetail: vi.fn(), MU_ESPN_ID: 360 }));

import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule, fetchEspnDetail } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';
import type { EspnScheduleEvent, EspnDetail } from '@/lib/types';

const mockFdMatches = vi.mocked(fetchMuMatches);
const mockEspnSchedule = vi.mocked(fetchEspnSchedule);
const mockEspnDetail = vi.mocked(fetchEspnDetail);

function finishedEvent(overrides: Partial<EspnScheduleEvent> = {}): EspnScheduleEvent {
  return {
    id: 'e1',
    date: '2026-08-22T11:30:00Z',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
        { homeAway: 'away', team: { id: '331', displayName: 'Brighton & Hove Albion' } },
      ],
      status: { type: { state: 'post' } },
    }],
    ...overrides,
  };
}

function goalDetail(scorer: string, assist?: string): EspnDetail {
  return {
    header: {
      competitions: [{
        status: { type: { state: 'post' } },
        details: [{
          scoringPlay: true,
          team: { id: '360' },
          participants: assist
            ? [{ athlete: { displayName: scorer } }, { athlete: { displayName: assist } }]
            : [{ athlete: { displayName: scorer } }],
        }],
      }],
    },
  };
}

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/leaders', () => {
  it('aggregates goals across every finished, non-friendly match', async () => {
    mockFdMatches.mockResolvedValue([]);
    // PL gets one finished match with an espn id; every other competition (CL/FA/EFL/FRIENDLY) gets none.
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent()] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes', 'Amad Diallo'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([{ name: 'Bruno Fernandes', count: 1 }]);
    expect(body.topAssists).toEqual([{ name: 'Amad Diallo', count: 1 }]);
    expect(mockEspnDetail).toHaveBeenCalledTimes(1);
  });

  it('excludes FRIENDLY matches from the aggregation even when finished', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'club.friendly' ? [finishedEvent({ id: 'f1' })] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([]);
    expect(mockEspnDetail).not.toHaveBeenCalled();
  });

  it('tolerates one match detail failing without losing the others (Promise.allSettled)', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent({ id: 'e1' }), finishedEvent({ id: 'e2' })] : []);
    mockEspnDetail
      .mockRejectedValueOnce(new Error('ESPN down for this one'))
      .mockResolvedValueOnce(goalDetail('Bruno Fernandes'));

    const res = await GET();
    const body = await res.json();

    expect(body.topScorers).toEqual([{ name: 'Bruno Fernandes', count: 1 }]);
    expect(res.status).toBe(200);
  });

  it('caches the result for LEADERS_TTL_MS and skips re-fetching on the next call', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockImplementation(async (slug: string) =>
      slug === 'eng.1' ? [finishedEvent()] : []);
    mockEspnDetail.mockResolvedValue(goalDetail('Bruno Fernandes'));

    await GET();
    await GET();

    expect(mockEspnSchedule).toHaveBeenCalledTimes(COMPETITIONS_COUNT);
  });
});

const COMPETITIONS_COUNT = 5; // PL, CL, FA, EFL, FRIENDLY — matches lib/competitions.ts
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run app/api/leaders/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 4: Implement `app/api/leaders/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule, fetchEspnDetail, MU_ESPN_ID } from '@/lib/espn';
import { mergeMatches } from '@/lib/merge';
import { extractMatchContributions, tallyLeaders } from '@/lib/leaders';
import { getCached, setCached, LEADERS_TTL_MS } from '@/lib/cache';
import { COMPETITIONS, getCompetition } from '@/lib/competitions';
import type { CompetitionId, EspnScheduleEvent, FdMatch, SeasonLeaders } from '@/lib/types';

const CACHE_KEY = 'leaders';

export async function GET() {
  const cached = getCached<SeasonLeaders>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.FOOTBALL_API_KEY || '';

  // Same fetch-and-merge as /api/matches (lib/fd + lib/espn + mergeMatches) — this route
  // needs its own independently-fetched match list (to reach `sources.espn`/`competition`
  // per fixture) rather than reading the 'matches' cache key, so it stays correct even
  // when this route is hit before /api/matches has ever populated that cache.
  const [fdResult, ...espnResults] = await Promise.allSettled([
    fetchMuMatches(apiKey),
    ...COMPETITIONS.map(c => fetchEspnSchedule(c.espnSlug)),
  ]);
  const fdMatches: FdMatch[] = fdResult.status === 'fulfilled' ? fdResult.value : [];
  const espnEventsByCompetition: Partial<Record<CompetitionId, EspnScheduleEvent[]>> = {};
  COMPETITIONS.forEach((c, i) => {
    const result = espnResults[i];
    espnEventsByCompetition[c.id] = result.status === 'fulfilled' ? result.value : [];
  });
  const matches = mergeMatches(fdMatches, espnEventsByCompetition);

  // Season leaders is a competitive-record view — Friendlies excluded, same as the
  // Stats page's W-D-L tiles. Only matches with an ESPN event id can have their
  // per-player detail fetched at all.
  const finishedMatches = matches.filter(
    m => m.status === 'FINISHED' && m.competition !== 'FRIENDLY' && m.sources.espn,
  );

  const detailResults = await Promise.allSettled(
    finishedMatches.map(m => fetchEspnDetail(getCompetition(m.competition).espnSlug, m.sources.espn!)),
  );

  const perMatch = detailResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchEspnDetail>>> => r.status === 'fulfilled')
    .map(r => extractMatchContributions(r.value, String(MU_ESPN_ID)));

  const leaders = tallyLeaders(perMatch);
  setCached(CACHE_KEY, leaders, LEADERS_TTL_MS);
  return NextResponse.json(leaders);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/api/leaders/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/cache.ts app/api/leaders/route.ts app/api/leaders/route.test.ts
git commit -m "feat: add /api/leaders route aggregating season goals/assists/cards"
```

---

### Task 3: Render Season Leaders on the Stats page

**Files:**
- Modify: `app/stats/page.tsx`
- Modify: `app/stats/page.module.css`
- Modify: `app/stats/page.test.tsx`

**Interfaces:**
- Consumes: `SeasonLeaders`/`PlayerTally` from `lib/types.ts` (Task 1); `LEADERS_TTL_MS` from `lib/cache.ts` (Task 2); `usePolling` from `hooks/usePolling.ts` (existing, already used elsewhere in this file).
- Produces: nothing consumed by another task — this is the last task.

- [ ] **Step 1: Write the failing tests**

In `app/stats/page.test.tsx`, add a helper and stub near the top (alongside the existing `stubMatches`):

```typescript
import type { SeasonLeaders } from '@/lib/types';

function stubMatchesAndLeaders(matches: Match[], leaders: SeasonLeaders) {
  const matchesResponse: MatchesResponse = { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/leaders')) return Promise.resolve({ ok: true, json: async () => leaders });
    return Promise.resolve({ ok: true, json: async () => matchesResponse });
  }));
}
```

Add these tests to the `describe('StatsPage', ...)` block:

```typescript
  it('shows Season Leaders once /api/leaders resolves', async () => {
    stubMatchesAndLeaders([match()], {
      topScorers: [{ name: 'Bruno Fernandes', count: 5 }],
      topAssists: [{ name: 'Amad Diallo', count: 3 }],
      topYellowCards: [{ name: 'Casemiro', count: 2 }],
    });

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Bruno Fernandes')).toBeInTheDocument();
    expect(screen.getByText('Amad Diallo')).toBeInTheDocument();
    expect(screen.getByText('Casemiro')).toBeInTheDocument();
  });

  it('shows an empty state for a leader category with no data yet', async () => {
    stubMatchesAndLeaders([match()], { topScorers: [], topAssists: [], topYellowCards: [] });

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getAllByText(/no data yet/i).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: The two new tests FAIL (no "Season Leaders" content rendered yet); all previously-existing tests in this file still PASS unchanged.

- [ ] **Step 3: Add the Season Leaders styles**

In `app/stats/page.module.css`, add:

```css
.leaders {
  margin-top: 20px;
}

.leadersGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.leaderBoard {
  padding: 12px 14px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(201, 162, 39, 0.3);
  border-radius: 3px;
}

.leaderBoardTitle {
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--mu-gold);
  margin: 0 0 8px;
}

.leaderRow {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12.5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.leaderRow:last-child {
  border-bottom: none;
}

.leaderCount {
  font-family: var(--font-mono);
  color: var(--mu-gold);
  font-weight: 700;
}

.leaderEmpty {
  font-size: 11px;
  opacity: 0.5;
}
```

- [ ] **Step 4: Render the Season Leaders section**

In `app/stats/page.tsx`, add the import and a second `usePolling` call, then render the section after the existing stat tiles / empty-state block (still inside `<main>`, as a sibling after the `{stats.played === 0 ? ... : ...}` block):

```typescript
import type { CompetitionId, MatchesResponse, SeasonLeaders } from '@/lib/types';
import { LIVE_TTL_MS, LEADERS_TTL_MS } from '@/lib/cache';
```

(This replaces the existing `import type { CompetitionId, MatchesResponse } from '@/lib/types';` and `import { LIVE_TTL_MS } from '@/lib/cache';` lines — add `SeasonLeaders` and `LEADERS_TTL_MS` to them respectively, don't duplicate the import statements.)

```typescript
async function fetchLeaders(): Promise<SeasonLeaders> {
  const res = await fetch('/api/leaders');
  if (!res.ok) throw new Error('Failed to load leaders');
  return res.json();
}
```

(Add this alongside the existing `fetchMatches` function.)

Inside the component, alongside the existing `usePolling(fetchMatches, ...)` call:

```typescript
  const { data: leaders } = usePolling(fetchLeaders, null, { key: 'leaders', ttlMs: LEADERS_TTL_MS });
```

After the closing `)}` of the existing `{stats.played === 0 ? (...) : (...)}` block, before the closing `</main>`:

```tsx
      <section className={styles.leaders}>
        <h2>Season Leaders</h2>
        <div className={styles.leadersGrid}>
          <div className={styles.leaderBoard}>
            <p className={styles.leaderBoardTitle}>Top Scorers</p>
            {leaders && leaders.topScorers.length > 0 ? (
              leaders.topScorers.map(p => (
                <div className={styles.leaderRow} key={p.name}>
                  <span>{p.name}</span>
                  <span className={styles.leaderCount}>{p.count}</span>
                </div>
              ))
            ) : (
              <p className={styles.leaderEmpty}>No data yet</p>
            )}
          </div>
          <div className={styles.leaderBoard}>
            <p className={styles.leaderBoardTitle}>Top Assists</p>
            {leaders && leaders.topAssists.length > 0 ? (
              leaders.topAssists.map(p => (
                <div className={styles.leaderRow} key={p.name}>
                  <span>{p.name}</span>
                  <span className={styles.leaderCount}>{p.count}</span>
                </div>
              ))
            ) : (
              <p className={styles.leaderEmpty}>No data yet</p>
            )}
          </div>
          <div className={styles.leaderBoard}>
            <p className={styles.leaderBoardTitle}>Top Yellow Cards</p>
            {leaders && leaders.topYellowCards.length > 0 ? (
              leaders.topYellowCards.map(p => (
                <div className={styles.leaderRow} key={p.name}>
                  <span>{p.name}</span>
                  <span className={styles.leaderCount}>{p.count}</span>
                </div>
              ))
            ) : (
              <p className={styles.leaderEmpty}>No data yet</p>
            )}
          </div>
        </div>
      </section>
```

Note: Season Leaders is intentionally **not** filtered by the `selected` competition tab — it always reflects all (non-friendly) competitions combined, per this plan's scope decision. It renders unconditionally (not inside the `stats.played === 0` empty-state branch), since it has its own independent empty state per category.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 6: Run the full suite, typecheck, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: PASS; build succeeds with no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/stats/page.tsx app/stats/page.module.css app/stats/page.test.tsx
git commit -m "feat: show Season Leaders (top scorer/assist/yellow card) on Stats page"
```

---

## Self-Review Notes

- **Spec coverage:** All three user-facing asks are covered — Top Scorer (Task 3, `topScorers`), Top Assist (Task 3, `topAssists`), Top Yellow Card (Task 3, `topYellowCards`); all-competitions-except-friendly scope (Task 2's filter); lazy fetch + hours-long cache (Task 2's `LEADERS_TTL_MS` + cache-check-first `GET`); Top 5 (Task 1's `tallyLeaders` default `topN = 5`).
- **Placeholder scan:** none — every step has complete, runnable code.
- **Type consistency:** `SeasonLeaders`/`PlayerTally` (Task 1) match what Task 2's route returns and what Task 3's page destructures and renders (`topScorers`/`topAssists`/`topYellowCards`, each `PlayerTally[]` with `name`/`count`). `extractMatchContributions`'s return shape (`{ goals, assists, yellowCards }: { goals: string[]; assists: string[]; yellowCards: string[] }`) matches exactly what `tallyLeaders` accepts as its `perMatch` parameter.
- **Data-shape verification:** the "Verified ESPN Data Shapes" section records what was checked against real ESPN API responses before writing this plan (goals/assists in `details`, cards in `keyEvents`, not the reverse) — Task 1's implementer does not need to re-verify this against a live API call, only against the test fixtures already written in this plan.
