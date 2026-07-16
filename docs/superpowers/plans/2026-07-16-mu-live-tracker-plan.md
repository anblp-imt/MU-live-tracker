# MU Live Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js + TypeScript live tracker for Manchester United (all competitions, current season, auto-detected) that merges football-data.org and ESPN into one domain model, organized as a sequence of React-concept milestones for learning purposes, with a distinct Manchester United visual identity.

**Architecture:** BFF pattern — Next.js Route Handlers call football-data.org and ESPN server-side, merge them into a unified `Match`/`StandingRow` model (pure, tested functions in `lib/`), and cache in-memory with content-aware TTL. All pages are client components; polling is hand-written (`useEffect` + `setInterval`), not a library, so each concept is visible.

**Tech Stack:** Next.js (App Router) + React + TypeScript, CSS Modules, vitest + @testing-library/react, no state-management or data-fetching library.

## Global Constraints

- TypeScript strict mode everywhere; no `any` except where a third-party JSON shape is genuinely partial (mark with a comment why).
- UI copy in English (per spec section 2).
- All pages are Client Components (`'use client'`) — no Server Components in this plan (spec section 5).
- No TanStack Query or similar — polling is a hand-written `useEffect`/`setInterval` hook (spec section 2/6).
- No CSS framework or component library — CSS Modules only.
- `FOOTBALL_API_KEY` is read only in `lib/fd.ts` / route handlers, never sent to the client.
- MU team IDs: football-data.org = `66`, ESPN = `360` (verified live 2026-07-16).
- Every `lib/` module is pure TypeScript with a colocated `*.test.ts` file, run via `npm test` (vitest).
- Every task's code must compile under `npx tsc --noEmit` before being committed.
- Every commit message and every code comment is in English; conversation with the user stays in Vietnamese but code artifacts are English (matches existing WC-2026 convention of English identifiers).
- Spec reference: `docs/superpowers/specs/2026-07-16-mu-live-tracker-design.md` — re-read section 6/7 (learning-first, MU identity) before writing any component; every client-side lifecycle-relevant line gets a `// [React] ...` comment explaining *why*, added to `LEARNING.md` too (Task 28).

## Verified real-world API shapes (found by live curl on 2026-07-16 — do not re-derive from memory)

**football-data.org v4** (`X-Auth-Token` header):
- `GET /v4/teams/66/matches` (no `season` param) → `{ resultSet, matches: [{ id, utcDate, status, competition: {code}, homeTeam: {name}, awayTeam: {name}, score: { duration, fullTime: {home,away}, regularTime?, extraTime? } }] }`. Team names include suffix, e.g. `"Manchester United FC"`, `"Hull City AFC"`. Right now (pre-season) only `competition.code === 'PL'` appears — CL/FA/EFL fixtures aren't released yet; this is expected, not a bug.
- `GET /v4/competitions/{PL|CL}/standings` → `{ standings: [{ type: 'TOTAL', table: [{ position, team: {name, crest}, playedGames, won, draw, lost, points, goalDifference }] }] }`.

**ESPN site API** (no auth, but send a `User-Agent` header):
- `GET https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams/360/schedule` → `{ season: {year, displayName}, events: [{ id, date, competitions: [{ competitors: [{ homeAway, team: {id, displayName}, score?: {value} }], status: { type: { state: 'pre'|'in'|'post', name? }, displayClock? } }] }] }`. **No `.details` field here** — scoring-play data is NOT on this endpoint, only on `/summary`. Team name is always exactly `"Manchester United"` (no suffix). Right now this returns 0 events for every slug for the 2026-27 season/`club.friendly` — ESPN hasn't published fixtures yet; expected during this pre-season window, not a bug. Verified structure using `?season=2025` (completed season) which returned real events.
- `GET https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/summary?event={id}` → `{ header: { competitions: [{ status: {type}, details?: [{ scoringPlay, ownGoal, penaltyKick, shootout, type?: {text, abbreviation}, clock: {displayValue}, team: {id}, participants: [{ athlete: {displayName} }] }], competitors: [{homeAway, team:{id}}] }] }, rosters: [{ homeAway, team: {displayName}, formation, roster: [{ starter, formationPlace, position: {abbreviation}, athlete: {displayName} }] }] }`.

These shapes drive every type in `lib/types.ts` below — they are not guesses.

---

## Milestone 0 — Bootstrap

### Task 1: Scaffold Next.js + TypeScript app

**Files:**
- Create: whole project scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `next-env.d.ts`)
- Create: `.env.local.example`
- Create: `.env.local` (not committed — gitignored by scaffold)
- Modify: `README.md` (quickstart)

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build` / `npm test` / `npm run typecheck` toolchain that every later task depends on.

- [ ] **Step 1: Run the scaffolder**

```bash
npx create-next-app@latest . --typescript --eslint --app --no-tailwind --no-src-dir --import-alias "@/*" --use-npm
```

If prompted about Turbopack or any other new flag, answer "No" / accept the default — we want the plain webpack dev server for predictability while learning.

- [ ] **Step 2: Verify the scaffold builds**

Run: `npm run build`
Expected: build succeeds, prints a route table including `/`.

- [ ] **Step 3: Add the football-data API key file**

Create `.env.local.example`:
```
FOOTBALL_API_KEY=your_football_data_org_token_here
```

Create `.env.local` (gitignored automatically by create-next-app's `.gitignore`, which already contains `.env*.local`) with the real value — reuse the WC-2026-live-tracker key for now:
```
FOOTBALL_API_KEY=<paste the value from d:\Project\Personal\WC-2026-live-tracker\.env>
```

- [ ] **Step 4: Add npm scripts for testing (installed in Task 2, referenced now)**

Edit `package.json` `scripts` to end up with:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Write README quickstart**

Replace `README.md` contents with:
```markdown
# MU Live Tracker

Live tracker for Manchester United across every competition in the current season.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in `FOOTBALL_API_KEY` (get a free key at https://www.football-data.org/client/register).
3. `npm run dev` — http://localhost:3000

## Scripts

- `npm test` — run all unit/component tests once
- `npm run test:watch` — watch mode
- `npm run typecheck` — TypeScript check with no output

See `docs/superpowers/specs/2026-07-16-mu-live-tracker-design.md` for the design, and `LEARNING.md` for the React concepts this codebase is built to teach.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript app"
```

---

### Task 2: Testing infrastructure (vitest + React Testing Library)

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/sanity.test.ts`

**Interfaces:**
- Produces: `npm test` running vitest with jsdom + `@testing-library/jest-dom` matchers globally available to every later task's tests.

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Write vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write a trivial failing test to prove wiring**

Create `lib/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('test infrastructure', () => {
  it('runs and can assert', () => {
    expect(1 + 1).toBe(3); // intentionally wrong first
  });
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `npm test`
Expected: FAIL — `expected 2 to be 3`.

- [ ] **Step 5: Fix the assertion**

```ts
import { describe, it, expect } from 'vitest';

describe('test infrastructure', () => {
  it('runs and can assert', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it and see it pass**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add vitest + RTL infrastructure"
```

---

### Task 3: MU theme tokens (global styles)

**Files:**
- Modify: `app/globals.css`
- Create: `app/globals.css.test.ts`

**Interfaces:**
- Produces: CSS custom properties (`--mu-red`, `--mu-red-dark`, `--mu-black`, `--mu-gold`, `--mu-white`) and a `fergie-pulse` keyframe animation, consumed by every component task from Task 15 onward.

- [ ] **Step 1: Write a smoke test asserting the tokens exist**

Create `app/globals.css.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('MU theme tokens', () => {
  const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

  it('defines the MU brand colors', () => {
    expect(css).toContain('--mu-red: #DA291C');
    expect(css).toContain('--mu-gold: #FFD700');
    expect(css).toContain('--mu-black');
  });

  it('defines the Fergie Time pulse animation', () => {
    expect(css).toContain('fergie-pulse');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test app/globals.css.test.ts`
Expected: FAIL — tokens not found (default Next.js `globals.css` doesn't have them).

- [ ] **Step 3: Replace `app/globals.css` contents**

```css
:root {
  --mu-red: #DA291C;
  --mu-red-dark: #9A1F14;
  --mu-black: #111111;
  --mu-gold: #FFD700;
  --mu-white: #F5F5F5;
  --font-heading: Georgia, 'Times New Roman', serif;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--mu-black);
  color: var(--mu-white);
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
}

h1, h2, h3 {
  font-family: var(--font-heading);
  color: var(--mu-red);
}

a {
  color: var(--mu-gold);
}

.badge-live {
  color: var(--mu-red);
  font-weight: bold;
}

.badge-ht {
  color: var(--mu-gold);
}

.badge-fergie {
  color: var(--mu-gold);
  font-weight: bold;
  animation: fergie-pulse 1s infinite;
}

@keyframes fergie-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npm test app/globals.css.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "style: add Manchester United theme tokens (red/black/gold, Fergie Time pulse)"
```

---

## Milestone 1 — BFF foundation (`lib/`, pure TypeScript)

### Task 4: `lib/types.ts` — domain and wire types

**Files:**
- Create: `lib/types.ts`

**Interfaces:**
- Produces: `CompetitionId`, `MatchStatus`, `Team`, `Score`, `MatchScore`, `Match`, `StandingRow`, `MatchesResponse`, `FdMatch`, `FdStandingRow`, `EspnScheduleEvent`, `EspnScoringDetail`, `EspnRosterPlayer`, `EspnRoster`, `EspnDetail`, `Scorers` — every later task imports from here. No runtime logic, so there is no unit test; the compiler is the check.

- [ ] **Step 1: Write the file**

```ts
// lib/types.ts

export type CompetitionId = 'PL' | 'CL' | 'FA' | 'EFL' | 'FRIENDLY';

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED';

export interface Team {
  name: string;
  crest?: string;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface MatchScore {
  fullTime: Score;
  display: Score;
}

export interface Match {
  id: string;
  utcDate: string;
  status: MatchStatus;
  competition: CompetitionId;
  home: Team;
  away: Team;
  venue: 'H' | 'A';
  score: MatchScore;
  minute?: string;
  sources: { fd?: number; espn?: string };
}

export interface StandingRow {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
}

export interface MatchesResponse {
  season: string;
  matches: Match[];
  meta: { sources: { fd: boolean; espn: boolean } };
}

export interface Scorers {
  home: Array<{ name: string; mins: string[] }>;
  away: Array<{ name: string; mins: string[] }>;
  redCards: {
    home: Array<{ name: string; min: string }>;
    away: Array<{ name: string; min: string }>;
  };
}

// --- football-data.org v4 wire types (subset actually used; verified live 2026-07-16) ---

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { code: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    duration: string;
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
    extraTime?: { home: number | null; away: number | null };
  };
}

export interface FdStandingRow {
  position: number;
  team: { name: string; crest?: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
}

// --- ESPN site-api wire types (subset actually used; verified live 2026-07-16) ---

export interface EspnScheduleEvent {
  id: string;
  date: string;
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away';
      team: { id: string; displayName: string };
      score?: { value: number };
    }>;
    status: { type: { state: 'pre' | 'in' | 'post'; name?: string }; displayClock?: string };
  }>;
}

export interface EspnScoringDetail {
  scoringPlay?: boolean;
  ownGoal?: boolean;
  penaltyKick?: boolean;
  shootout?: boolean;
  type?: { text?: string; abbreviation?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  participants?: Array<{ athlete?: { displayName?: string } }>;
}

export interface EspnRosterPlayer {
  starter: boolean;
  formationPlace?: string;
  position?: { abbreviation?: string };
  athlete?: { displayName?: string };
}

export interface EspnRoster {
  homeAway: 'home' | 'away';
  team?: { displayName?: string };
  formation?: string;
  roster: EspnRosterPlayer[];
}

export interface EspnDetail {
  header: {
    competitions: Array<{
      status: { type: { state: 'pre' | 'in' | 'post'; name?: string }; displayClock?: string };
      details?: EspnScoringDetail[];
      competitors?: Array<{ homeAway: 'home' | 'away'; team?: { id?: string } }>;
    }>;
  };
  rosters?: EspnRoster[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add domain and wire types for football-data/ESPN merge"
```

---

### Task 5: `lib/competitions.ts` — competition mapping table

**Files:**
- Create: `lib/competitions.ts`
- Test: `lib/competitions.test.ts`

**Interfaces:**
- Consumes: `CompetitionId` from `lib/types.ts` (Task 4).
- Produces: `COMPETITIONS`, `getCompetition(id)`, `competitionIdForFdCode(code)` — used by `lib/merge.ts` (Task 9), `app/api/matches/route.ts` (Task 12), `components/MatchCard.tsx` (Task 15), `components/CompetitionFilterPills.tsx` (Task 18).

- [ ] **Step 1: Write the failing tests**

Create `lib/competitions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { COMPETITIONS, getCompetition, competitionIdForFdCode } from './competitions';

describe('competitions mapping', () => {
  it('lists all 5 competitions with an ESPN slug', () => {
    expect(COMPETITIONS).toHaveLength(5);
    expect(COMPETITIONS.every(c => c.espnSlug.length > 0)).toBe(true);
  });

  it('getCompetition returns the Premier League mapping', () => {
    expect(getCompetition('PL')).toMatchObject({ espnSlug: 'eng.1', hasStandings: true });
  });

  it('getCompetition throws for an unknown id', () => {
    // @ts-expect-error deliberately invalid id to test the runtime guard
    expect(() => getCompetition('XX')).toThrow();
  });

  it('competitionIdForFdCode maps PL and CL, and returns undefined for cup codes not covered by FD', () => {
    expect(competitionIdForFdCode('PL')).toBe('PL');
    expect(competitionIdForFdCode('CL')).toBe('CL');
    expect(competitionIdForFdCode('FA')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/competitions.test.ts`
Expected: FAIL — `Cannot find module './competitions'`.

- [ ] **Step 3: Implement**

```ts
// lib/competitions.ts
import type { CompetitionId } from './types';

export interface CompetitionMapping {
  id: CompetitionId;
  label: string;
  fdCode?: 'PL' | 'CL';
  espnSlug: string;
  hasStandings: boolean;
}

export const COMPETITIONS: CompetitionMapping[] = [
  { id: 'PL', label: 'Premier League', fdCode: 'PL', espnSlug: 'eng.1', hasStandings: true },
  { id: 'CL', label: 'UEFA Champions League', fdCode: 'CL', espnSlug: 'uefa.champions', hasStandings: true },
  { id: 'FA', label: 'FA Cup', espnSlug: 'eng.fa', hasStandings: false },
  { id: 'EFL', label: 'Carabao Cup', espnSlug: 'eng.league_cup', hasStandings: false },
  { id: 'FRIENDLY', label: 'Friendly', espnSlug: 'club.friendly', hasStandings: false },
];

export function getCompetition(id: CompetitionId): CompetitionMapping {
  const found = COMPETITIONS.find(c => c.id === id);
  if (!found) throw new Error(`Unknown competition id: ${id}`);
  return found;
}

export function competitionIdForFdCode(code: string): CompetitionId | undefined {
  return COMPETITIONS.find(c => c.fdCode === code)?.id;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/competitions.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/competitions.ts lib/competitions.test.ts
git commit -m "feat: add competition mapping table (PL/CL/FA/EFL/friendly)"
```

---

### Task 6: `lib/normalize.ts` — team name normalization

**Files:**
- Create: `lib/normalize.ts`
- Test: `lib/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeTeamName(name)`, `isManUtd(name)` — used by `lib/merge.ts` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `lib/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeTeamName, isManUtd } from './normalize';

describe('normalizeTeamName', () => {
  it('lowercases and strips punctuation/spaces', () => {
    expect(normalizeTeamName('Nottingham Forest FC')).toBe('nottinghamforestfc');
  });

  it('strips accents via NFD decomposition', () => {
    expect(normalizeTeamName('Bayern München')).toBe('bayernmunchen');
  });

  it('handles empty/undefined input without throwing', () => {
    expect(normalizeTeamName('')).toBe('');
  });
});

describe('isManUtd', () => {
  it('matches football-data\'s "Manchester United FC"', () => {
    expect(isManUtd('Manchester United FC')).toBe(true);
  });

  it('matches ESPN\'s plain "Manchester United"', () => {
    expect(isManUtd('Manchester United')).toBe(true);
  });

  it('does not match Manchester City', () => {
    expect(isManUtd('Manchester City FC')).toBe(false);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/normalize.ts

// NFD decomposition splits accented letters into base+combining-mark, so stripping the
// combining marks (U+0300–U+036F) removes accents without a manual character map —
// "München" → "Munchen". Ported from WC-2026-live-tracker/utils.js's normTeam.
export function normalizeTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const MU_TOKEN = 'manchesterunited';

// Both sources always spell the club's name out in full ("Manchester United FC" on
// football-data, "Manchester United" on ESPN) — verified live 2026-07-16 — so a simple
// substring check on the normalized name is enough; no abbreviation table needed.
export function isManUtd(name: string): boolean {
  return normalizeTeamName(name).includes(MU_TOKEN);
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/normalize.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/normalize.ts lib/normalize.test.ts
git commit -m "feat: add team name normalization (NFD accent stripping, MU detection)"
```

---

### Task 7: `lib/cache.ts` — in-memory content-aware TTL cache

**Files:**
- Create: `lib/cache.ts`
- Test: `lib/cache.test.ts`

**Interfaces:**
- Produces: `getCached<T>(key)`, `setCached<T>(key, value, ttlMs)`, `clearCache()`, `LIVE_TTL_MS`, `STATIC_TTL_MS`, `matchesTtlMs(matches)` — used by every route handler task (12, 13, 14).

- [ ] **Step 1: Write the failing tests**

Create `lib/cache.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, setCached, clearCache, matchesTtlMs, LIVE_TTL_MS, STATIC_TTL_MS } from './cache';

describe('in-memory cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    expect(getCached('nope')).toBeUndefined();
  });

  it('returns a stored value before it expires', () => {
    setCached('k', { a: 1 }, 1000);
    expect(getCached('k')).toEqual({ a: 1 });
  });

  it('returns undefined after the TTL elapses', () => {
    vi.useFakeTimers();
    setCached('k', 'v', 1000);
    vi.advanceTimersByTime(1001);
    expect(getCached('k')).toBeUndefined();
    vi.useRealTimers();
  });
});

describe('matchesTtlMs', () => {
  it('returns the live TTL when a match is IN_PLAY', () => {
    expect(matchesTtlMs([{ status: 'IN_PLAY' }])).toBe(LIVE_TTL_MS);
  });

  it('returns the live TTL when a match is PAUSED', () => {
    expect(matchesTtlMs([{ status: 'PAUSED' }])).toBe(LIVE_TTL_MS);
  });

  it('returns the static TTL when nothing is live', () => {
    expect(matchesTtlMs([{ status: 'SCHEDULED' }, { status: 'FINISHED' }])).toBe(STATIC_TTL_MS);
  });

  it('returns the static TTL for an empty list', () => {
    expect(matchesTtlMs([])).toBe(STATIC_TTL_MS);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/cache.ts

// Module-level Map = one cache per server process, which is exactly what the spec calls
// for at this stage (local dev, single process). Ported concept from
// WC-2026-live-tracker/functions/_lib/cache.mjs, simplified: that version cached at the
// edge (Cloudflare `caches.default`) with stale-if-error; we don't need that here because
// error handling happens one level up, in the route handler (Promise.allSettled).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry || Date.now() >= entry.expiresAt) return undefined;
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}

export const LIVE_TTL_MS = 30_000;
export const STATIC_TTL_MS = 300_000;

export function matchesTtlMs(matches: Array<{ status: string }>): number {
  const hasLive = matches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return hasLive ? LIVE_TTL_MS : STATIC_TTL_MS;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/cache.test.ts`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/cache.ts lib/cache.test.ts
git commit -m "feat: add in-memory content-aware TTL cache"
```

---

### Task 8: `lib/season.ts` — current season detection

**Files:**
- Create: `lib/season.ts`
- Test: `lib/season.test.ts`

**Interfaces:**
- Produces: `currentSeasonLabel(now?)` — used by `app/api/matches/route.ts` (Task 12).

- [ ] **Step 1: Write the failing tests**

Create `lib/season.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { currentSeasonLabel } from './season';

describe('currentSeasonLabel', () => {
  it('is "2026-27" in the middle of that season (July 2026)', () => {
    expect(currentSeasonLabel(new Date('2026-07-16T00:00:00Z'))).toBe('2026-27');
  });

  it('is still "2025-26" in June, before the new season starts', () => {
    expect(currentSeasonLabel(new Date('2026-06-30T00:00:00Z'))).toBe('2025-26');
  });

  it('is "2025-26" in January (mid-season)', () => {
    expect(currentSeasonLabel(new Date('2026-01-05T00:00:00Z'))).toBe('2025-26');
  });

  it('flips to "2026-27" in December', () => {
    expect(currentSeasonLabel(new Date('2026-12-31T00:00:00Z'))).toBe('2026-27');
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/season.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/season.ts

// European club season runs Aug→May, so July counts as the start of the *upcoming*
// season (pre-season). Heuristic from HANDOFF.md section 2; football-data.org's own
// season-less endpoint is the primary source of truth for which fixtures show up, this
// label is only used for display (e.g. "2026-27" in the season header).
export function currentSeasonLabel(now: Date = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 7 ? year : year - 1;
  const endYy = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYy}`;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/season.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/season.ts lib/season.test.ts
git commit -m "feat: add current-season label detection"
```

---

### Task 9: `lib/merge.ts` — matchKey, computeDisplayScore, mergeMatches, extractScorers

**Files:**
- Create: `lib/merge.ts`
- Test: `lib/merge.test.ts`

**Interfaces:**
- Consumes: `CompetitionId`, `FdMatch`, `EspnScheduleEvent`, `EspnScoringDetail`, `Match`, `Scorers` (Task 4); `normalizeTeamName`, `isManUtd` (Task 6); `COMPETITIONS`, `competitionIdForFdCode` (Task 5).
- Produces: `matchKey(utcDate, opponentName)`, `computeDisplayScore(fdScore)`, `mergeMatches(fdMatches, espnEventsByCompetition)`, `extractScorers(detail, homeTeamEspnId)` — used by `app/api/matches/route.ts` (Task 12) and `app/match/[id]/page.tsx` (Task 27). This is the highest-risk file per the design spec (section 5's "bài học xương máu") — every branch below has a test.

This is the biggest task in the plan. Do all 4 steps for **matchKey + computeDisplayScore** first, commit, then continue with **mergeMatches**, then **extractScorers**, each as its own commit — don't try to write all the code before running any test.

- [ ] **Step 1: Write failing tests for matchKey and computeDisplayScore**

Create `lib/merge.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchKey, computeDisplayScore } from './merge';
import type { FdMatch } from './types';

describe('matchKey', () => {
  it('combines the UTC date (day only) with the normalized opponent name', () => {
    expect(matchKey('2026-08-22T11:30:00Z', 'Hull City AFC')).toBe('2026-08-22_hullcityafc');
  });

  it('normalizes accents/case so both sources produce the same key', () => {
    expect(matchKey('2026-10-01T19:00:00Z', 'Bayern München')).toBe(
      matchKey('2026-10-01T19:00:00Z', 'BAYERN MUENCHEN'.replace('UE', 'Ü')),
    );
  });
});

describe('computeDisplayScore', () => {
  it('uses fullTime for a normal REGULAR finish', () => {
    const score: FdMatch['score'] = { duration: 'REGULAR', fullTime: { home: 2, away: 1 } };
    expect(computeDisplayScore(score)).toEqual({ home: 2, away: 1 });
  });

  it('uses fullTime for an EXTRA_TIME finish (no shootout)', () => {
    const score: FdMatch['score'] = { duration: 'EXTRA_TIME', fullTime: { home: 3, away: 2 } };
    expect(computeDisplayScore(score)).toEqual({ home: 3, away: 2 });
  });

  it('sums regularTime + extraTime for a PENALTY_SHOOTOUT finish, ignoring fullTime', () => {
    // fullTime would include shootout goals here (e.g. 5-4) — the pre-penalty score is 1-1.
    const score: FdMatch['score'] = {
      duration: 'PENALTY_SHOOTOUT',
      fullTime: { home: 5, away: 4 },
      regularTime: { home: 1, away: 1 },
      extraTime: { home: 0, away: 0 },
    };
    expect(computeDisplayScore(score)).toEqual({ home: 1, away: 1 });
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/merge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement matchKey and computeDisplayScore**

Create `lib/merge.ts`:
```ts
// lib/merge.ts
import type { CompetitionId, EspnScheduleEvent, EspnScoringDetail, FdMatch, Match, Scorers } from './types';
import { normalizeTeamName, isManUtd } from './normalize';
import { COMPETITIONS, competitionIdForFdCode } from './competitions';

function dayKey(iso: string): string {
  return (iso || '').slice(0, 10);
}

export function matchKey(utcDate: string, opponentName: string): string {
  return `${dayKey(utcDate)}_${normalizeTeamName(opponentName)}`;
}

// football-data's `fullTime` includes shootout goals when duration is PENALTY_SHOOTOUT
// (fullTime = regularTime + penalties), so it can't be used as the pre-penalty score.
// regularTime + extraTime gives the true score to display. Ported from
// WC-2026-live-tracker/utils.js's preShootoutScore (bug fixed there in commit d4670ba).
export function computeDisplayScore(score: FdMatch['score']): { home: number | null; away: number | null } {
  if (score.duration === 'PENALTY_SHOOTOUT' && score.regularTime) {
    return {
      home: (score.regularTime.home ?? 0) + (score.extraTime?.home ?? 0),
      away: (score.regularTime.away ?? 0) + (score.extraTime?.away ?? 0),
    };
  }
  return { home: score.fullTime.home, away: score.fullTime.away };
}
```

- [ ] **Step 4: Run and see those tests pass**

Run: `npm test lib/merge.test.ts`
Expected: PASS — 4 tests passed (the file will still fail to fully type-check as a module until `mergeMatches` exists if anything imports it yet — nothing does yet, so this is fine).

- [ ] **Step 5: Commit**

```bash
git add lib/merge.ts lib/merge.test.ts
git commit -m "feat: add matchKey and pre-shootout display score"
```

- [ ] **Step 6: Write failing tests for mergeMatches**

Append to `lib/merge.test.ts`:
```ts
import { mergeMatches } from './merge';
import type { EspnScheduleEvent } from './types';

function fd(overrides: Partial<FdMatch> = {}): FdMatch {
  return {
    id: 1,
    utcDate: '2026-08-22T11:30:00Z',
    status: 'SCHEDULED',
    competition: { code: 'PL' },
    homeTeam: { name: 'Hull City AFC' },
    awayTeam: { name: 'Manchester United FC' },
    score: { duration: 'REGULAR', fullTime: { home: null, away: null } },
    ...overrides,
  };
}

function espnEvent(overrides: Partial<EspnScheduleEvent> = {}): EspnScheduleEvent {
  return {
    id: 'e1',
    date: '2026-08-22T11:30:00Z',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: '999', displayName: 'Hull City' } },
        { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' } },
      ],
      status: { type: { state: 'pre' } },
    }],
    ...overrides,
  };
}

describe('mergeMatches', () => {
  it('converts an FD-only match using MU perspective (venue, opponent)', () => {
    const result = mergeMatches([fd()], {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '2026-08-22_hullcityafc',
      competition: 'PL',
      venue: 'A',
      sources: { fd: 1 },
    });
    expect(result[0].sources.espn).toBeUndefined();
  });

  it('enriches an FD match with a matching ESPN event (same fixture, live status wins)', () => {
    const liveEspn = espnEvent({
      competitions: [{
        competitors: espnEvent().competitions[0].competitors,
        status: { type: { state: 'in' }, displayClock: "23'" },
      }],
    });
    const result = mergeMatches([fd()], { PL: [liveEspn] });
    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual({ fd: 1, espn: 'e1' });
    expect(result[0].status).toBe('IN_PLAY');
    expect(result[0].minute).toBe("23'");
  });

  it('includes an ESPN-only friendly fixture with no FD counterpart', () => {
    const friendly = espnEvent({
      id: 'f1',
      date: '2026-07-20T18:00:00Z',
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '360', displayName: 'Manchester United' } },
          { homeAway: 'away', team: { id: '111', displayName: 'Leeds United' } },
        ],
        status: { type: { state: 'pre' } },
      }],
    });
    const result = mergeMatches([], { FRIENDLY: [friendly] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ competition: 'FRIENDLY', venue: 'H', sources: { espn: 'f1' } });
    expect(result[0].sources.fd).toBeUndefined();
  });

  it('sorts the combined list by utcDate ascending', () => {
    const early = fd({ id: 1, utcDate: '2026-08-22T11:30:00Z', awayTeam: { name: 'Manchester United FC' }, homeTeam: { name: 'Hull City AFC' } });
    const late = fd({ id: 2, utcDate: '2026-09-01T11:30:00Z', awayTeam: { name: 'Manchester United FC' }, homeTeam: { name: 'Everton FC' } });
    const result = mergeMatches([late, early], {});
    expect(result.map(m => m.id)).toEqual([
      matchKey(early.utcDate, 'Hull City AFC'),
      matchKey(late.utcDate, 'Everton FC'),
    ]);
  });
});
```

- [ ] **Step 7: Run and see it fail**

Run: `npm test lib/merge.test.ts`
Expected: FAIL — `mergeMatches is not exported`.

- [ ] **Step 8: Implement mergeMatches**

Append to `lib/merge.ts`:
```ts
function opponentFromFd(m: FdMatch): { name: string; venue: 'H' | 'A' } {
  return isManUtd(m.homeTeam.name)
    ? { name: m.awayTeam.name, venue: 'H' }
    : { name: m.homeTeam.name, venue: 'A' };
}

function opponentFromEspn(ev: EspnScheduleEvent): { name: string; venue: 'H' | 'A' } | null {
  const comp = ev.competitions[0];
  const mu = comp?.competitors.find(c => isManUtd(c.team.displayName));
  const opp = comp?.competitors.find(c => !isManUtd(c.team.displayName));
  if (!mu || !opp) return null;
  return { name: opp.team.displayName, venue: mu.homeAway === 'home' ? 'H' : 'A' };
}

function fdToMatch(m: FdMatch): Match | null {
  const competition = competitionIdForFdCode(m.competition.code);
  if (!competition) return null;
  const { name: opponentName, venue } = opponentFromFd(m);
  return {
    id: matchKey(m.utcDate, opponentName),
    utcDate: m.utcDate,
    status: m.status as Match['status'],
    competition,
    home: { name: m.homeTeam.name },
    away: { name: m.awayTeam.name },
    venue,
    score: { fullTime: { home: m.score.fullTime.home, away: m.score.fullTime.away }, display: computeDisplayScore(m.score) },
    sources: { fd: m.id },
  };
}

function espnStatusToMatchStatus(state: string, typeName?: string): Match['status'] {
  if (state === 'in') return typeName === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
  if (state === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

function espnToMatch(ev: EspnScheduleEvent, competition: CompetitionId): Match | null {
  const opponent = opponentFromEspn(ev);
  if (!opponent) return null;
  const comp = ev.competitions[0];
  const status = espnStatusToMatchStatus(comp.status.type.state, comp.status.type.name);
  const mu = comp.competitors.find(c => isManUtd(c.team.displayName))!;
  const opp = comp.competitors.find(c => !isManUtd(c.team.displayName))!;
  const home = mu.homeAway === 'home' ? mu : opp;
  const away = mu.homeAway === 'home' ? opp : mu;
  const score = status === 'SCHEDULED'
    ? { home: null, away: null }
    : { home: home.score?.value ?? null, away: away.score?.value ?? null };
  return {
    id: matchKey(ev.date, opponent.name),
    utcDate: ev.date,
    status,
    competition,
    home: { name: home.team.displayName },
    away: { name: away.team.displayName },
    venue: opponent.venue,
    score: { fullTime: score, display: score },
    minute: comp.status.displayClock,
    sources: { espn: ev.id },
  };
}

// FD is the backbone for PL/CL (status + score); ESPN enriches the same fixture with a
// faster-updating live status/minute (FD lags at kickoff and full-time — see
// WC-2026-live-tracker commit 38fe14b/d4670ba). Competitions FD doesn't cover at all
// (FA/EFL/friendly) come from ESPN alone. See design spec section 4.
export function mergeMatches(
  fdMatches: FdMatch[],
  espnEventsByCompetition: Partial<Record<CompetitionId, EspnScheduleEvent[]>>,
): Match[] {
  const fdConverted = fdMatches.map(fdToMatch).filter((m): m is Match => m !== null);
  const fdByKey = new Map(fdConverted.map(m => [m.id, m]));
  const espnOnly: Match[] = [];

  for (const { id: competition } of COMPETITIONS) {
    const events = espnEventsByCompetition[competition] || [];
    for (const ev of events) {
      const converted = espnToMatch(ev, competition);
      if (!converted) continue;
      const existing = fdByKey.get(converted.id);
      if (existing) {
        existing.sources.espn = converted.sources.espn;
        if (converted.status === 'IN_PLAY' || converted.status === 'PAUSED' || converted.status === 'FINISHED') {
          existing.status = converted.status;
          existing.minute = converted.minute;
        }
        continue;
      }
      espnOnly.push(converted);
    }
  }

  return [...fdConverted, ...espnOnly].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}
```

- [ ] **Step 9: Run and see it pass**

Run: `npm test lib/merge.test.ts`
Expected: PASS — 8 tests passed.

- [ ] **Step 10: Commit**

```bash
git add lib/merge.ts lib/merge.test.ts
git commit -m "feat: add mergeMatches (FD backbone + ESPN enrichment + ESPN-only cup/friendly)"
```

- [ ] **Step 11: Write failing tests for extractScorers**

Append to `lib/merge.test.ts`. This fixture mirrors the real ESPN `/summary` shape for MU 3-0 Brighton (event 740966, verified live 2026-07-16 with `?season=2025`):
```ts
import { extractScorers } from './merge';
import type { EspnDetail } from './types';

describe('extractScorers', () => {
  const detail: EspnDetail = {
    header: {
      competitions: [{
        status: { type: { state: 'post' } },
        details: [
          {
            scoringPlay: true, clock: { displayValue: "33'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }],
          },
          {
            scoringPlay: true, clock: { displayValue: "44'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Bryan Mbeumo' } }],
          },
          {
            scoringPlay: true, penaltyKick: true, clock: { displayValue: "48'" },
            team: { id: '360' }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }],
          },
          {
            scoringPlay: false, type: { text: 'Red Card', abbreviation: 'RC' }, clock: { displayValue: "80'" },
            team: { id: '331' }, participants: [{ athlete: { displayName: 'Some Defender' } }],
          },
        ],
      }],
    },
  };

  it('groups goals by scorer and marks penalties', () => {
    const result = extractScorers(detail, '331'); // home team id = Brighton in this fixture
    expect(result.away).toEqual([
      { name: 'Patrick Dorgu', mins: ["33'"] },
      { name: 'Bryan Mbeumo', mins: ["44'"] },
      { name: 'Bruno Fernandes', mins: ["48' (P)"] },
    ]);
    expect(result.home).toEqual([]);
  });

  it('collects red cards separately from goals, attributed by team', () => {
    const result = extractScorers(detail, '331');
    expect(result.redCards.home).toEqual([{ name: 'Some Defender', min: "80'" }]);
    expect(result.redCards.away).toEqual([]);
  });
});
```

- [ ] **Step 12: Run and see it fail**

Run: `npm test lib/merge.test.ts`
Expected: FAIL — `extractScorers is not exported`.

- [ ] **Step 13: Implement extractScorers**

Append to `lib/merge.ts`:
```ts
function groupByScorer(entries: EspnScoringDetail[]): Array<{ name: string; mins: string[] }> {
  const order: string[] = [];
  const byName: Record<string, string[]> = {};
  entries.forEach(g => {
    const name = g.participants?.[0]?.athlete?.displayName || '?';
    const mark = g.penaltyKick ? ' (P)' : g.ownGoal ? ' (OG)' : '';
    const min = (g.clock?.displayValue || '') + mark;
    if (!byName[name]) { byName[name] = []; order.push(name); }
    byName[name].push(min);
  });
  return order.map(name => ({ name, mins: byName[name] }));
}

// Reads the /summary detail response (Task 11's fetchEspnDetail), NOT the schedule
// event — the team-schedule endpoint has no play-by-play `.details` at all (verified
// live 2026-07-16). homeTeamEspnId comes from
// detail.header.competitions[0].competitors.find(c => c.homeAway === 'home').team.id.
export function extractScorers(detail: EspnDetail, homeTeamEspnId: string): Scorers {
  const details = detail.header.competitions[0]?.details || [];
  const goals = details.filter(d => d.scoringPlay && !d.shootout);
  const home = groupByScorer(goals.filter(g => g.team?.id === homeTeamEspnId));
  const away = groupByScorer(goals.filter(g => g.team?.id !== homeTeamEspnId));

  const isRedCard = (d: EspnScoringDetail) =>
    !d.scoringPlay && (
      d.type?.text?.toLowerCase().includes('red card') ||
      d.type?.abbreviation?.toUpperCase() === 'RC'
    );
  const cards = details.filter(isRedCard);
  const redCards = {
    home: cards.filter(d => d.team?.id === homeTeamEspnId)
      .map(d => ({ name: d.participants?.[0]?.athlete?.displayName || '?', min: d.clock?.displayValue || '' })),
    away: cards.filter(d => d.team?.id !== homeTeamEspnId)
      .map(d => ({ name: d.participants?.[0]?.athlete?.displayName || '?', min: d.clock?.displayValue || '' })),
  };

  return { home, away, redCards };
}
```

- [ ] **Step 14: Run and see it pass**

Run: `npm test lib/merge.test.ts`
Expected: PASS — 10 tests passed total.

- [ ] **Step 15: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/merge.ts lib/merge.test.ts
git commit -m "feat: add extractScorers (goals grouped by scorer, red cards, from ESPN summary)"
```

---

### Task 10: `lib/fd.ts` — football-data.org client

**Files:**
- Create: `lib/fd.ts`
- Test: `lib/fd.test.ts`

**Interfaces:**
- Consumes: `FdMatch`, `FdStandingRow` (Task 4).
- Produces: `fetchMuMatches(apiKey)`, `fetchStandings(apiKey, comp)`, `FdApiError` — used by `app/api/matches/route.ts` (Task 12), `app/api/standings/route.ts` (Task 13).

- [ ] **Step 1: Write the failing tests**

Create `lib/fd.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMuMatches, fetchStandings, FdApiError } from './fd';

const MU_FD_ID = 66;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMuMatches', () => {
  it('sends the API key as X-Auth-Token and hits /teams/66/matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ matches: [{ id: 1 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMuMatches('secret-key');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.football-data.org/v4/teams/${MU_FD_ID}/matches`,
      { headers: { 'X-Auth-Token': 'secret-key' } },
    );
    expect(result).toEqual([{ id: 1 }]);
  });

  it('returns an empty array when the response has no matches field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    expect(await fetchMuMatches('k')).toEqual([]);
  });

  it('throws FdApiError with code RATE_LIMIT on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'RATE_LIMIT' } satisfies Partial<FdApiError>);
  });

  it('throws FdApiError with code INVALID_KEY on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'INVALID_KEY' });
  });

  it('throws FdApiError with code NETWORK when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('fetchStandings', () => {
  it('extracts the TOTAL table for the given competition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ standings: [{ type: 'TOTAL', table: [{ position: 1 }] }] }),
    }));
    expect(await fetchStandings('k', 'PL')).toEqual([{ position: 1 }]);
  });

  it('returns an empty array when there is no TOTAL entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ standings: [] }) }));
    expect(await fetchStandings('k', 'CL')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/fd.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/fd.ts
import type { FdMatch, FdStandingRow } from './types';

const FD_BASE = 'https://api.football-data.org/v4';
const MU_FD_ID = 66;

export class FdApiError extends Error {
  code: 'INVALID_KEY' | 'PLAN_LIMIT' | 'RATE_LIMIT' | 'NOT_FOUND' | 'NETWORK' | 'HTTP';
  constructor(code: FdApiError['code'], message: string) {
    super(message);
    this.name = 'FdApiError';
    this.code = code;
  }
}

async function fdFetch(path: string, apiKey: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${FD_BASE}${path}`, { headers: { 'X-Auth-Token': apiKey } });
  } catch (e) {
    throw new FdApiError('NETWORK', e instanceof Error ? e.message : 'network error');
  }
  if (res.status === 400 || res.status === 401) throw new FdApiError('INVALID_KEY', 'Invalid API key');
  if (res.status === 403) throw new FdApiError('PLAN_LIMIT', 'No access to this competition');
  if (res.status === 429) throw new FdApiError('RATE_LIMIT', 'Rate limit exceeded (10 req/min)');
  if (res.status === 404) throw new FdApiError('NOT_FOUND', 'Endpoint not found');
  if (!res.ok) throw new FdApiError('HTTP', `HTTP ${res.status}`);
  return res.json();
}

export async function fetchMuMatches(apiKey: string): Promise<FdMatch[]> {
  const data = (await fdFetch(`/teams/${MU_FD_ID}/matches`, apiKey)) as { matches?: FdMatch[] };
  return data.matches || [];
}

export async function fetchStandings(apiKey: string, comp: 'PL' | 'CL'): Promise<FdStandingRow[]> {
  const data = (await fdFetch(`/competitions/${comp}/standings`, apiKey)) as {
    standings?: Array<{ type: string; table: FdStandingRow[] }>;
  };
  return data.standings?.find(s => s.type === 'TOTAL')?.table || [];
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/fd.test.ts`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/fd.ts lib/fd.test.ts
git commit -m "feat: add football-data.org client (matches, standings, error mapping)"
```

---

### Task 11: `lib/espn.ts` — ESPN client

**Files:**
- Create: `lib/espn.ts`
- Test: `lib/espn.test.ts`

**Interfaces:**
- Consumes: `EspnScheduleEvent`, `EspnDetail` (Task 4).
- Produces: `fetchEspnSchedule(slug)`, `fetchEspnDetail(slug, eventId)` — used by `app/api/matches/route.ts` (Task 12), `app/api/match/[id]/route.ts` (Task 14).

- [ ] **Step 1: Write the failing tests**

Create `lib/espn.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEspnSchedule, fetchEspnDetail } from './espn';

const MU_ESPN_ID = 360;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchEspnSchedule', () => {
  it('hits the per-team schedule endpoint for the given league slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [{ id: 'e1' }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchEspnSchedule('eng.1');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/${MU_ESPN_ID}/schedule`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    expect(result).toEqual([{ id: 'e1' }]);
  });

  it('returns an empty array when the league has no fixtures yet (verified real ESPN behavior pre-season)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));
    expect(await fetchEspnSchedule('club.friendly')).toEqual([]);
  });

  it('throws when ESPN returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchEspnSchedule('eng.1')).rejects.toThrow('ESPN HTTP 500');
  });

  it('throws when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(fetchEspnSchedule('eng.1')).rejects.toThrow(/network/i);
  });
});

describe('fetchEspnDetail', () => {
  it('hits the per-league summary endpoint with the event id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ header: { competitions: [] } }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEspnDetail('eng.1', '740966');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=740966',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/espn.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/espn.ts
import type { EspnDetail, EspnScheduleEvent } from './types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const MU_ESPN_ID = 360;

async function espnFetch(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${ESPN_BASE}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch (e) {
    throw new Error('ESPN network error: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  return res.json();
}

// Per-team schedule, not per-date scoreboard (unlike WC-2026-live-tracker) — HANDOFF.md
// section 2 chose this because it lets one call per league slug cover the whole season,
// and empty results dynamically tell us MU isn't (yet) in that competition. Verified live
// 2026-07-16: this endpoint has NO play-by-play `.details` — only fetchEspnDetail does.
export async function fetchEspnSchedule(slug: string): Promise<EspnScheduleEvent[]> {
  const data = (await espnFetch(`/${slug}/teams/${MU_ESPN_ID}/schedule`)) as { events?: EspnScheduleEvent[] };
  return data.events || [];
}

export async function fetchEspnDetail(slug: string, eventId: string): Promise<EspnDetail> {
  return (await espnFetch(`/${slug}/summary?event=${eventId}`)) as EspnDetail;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/espn.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/espn.ts lib/espn.test.ts
git commit -m "feat: add ESPN client (team schedule + match summary)"
```

---

## Milestone 1b — Route handlers (wire `lib/` together)

### Task 12: `app/api/matches/route.ts`

**Files:**
- Create: `app/api/matches/route.ts`
- Test: `app/api/matches/route.test.ts`

**Interfaces:**
- Consumes: `fetchMuMatches` (Task 10), `fetchEspnSchedule` (Task 11), `mergeMatches` (Task 9), `getCached`/`setCached`/`matchesTtlMs` (Task 7), `currentSeasonLabel` (Task 8), `COMPETITIONS` (Task 5).
- Produces: `GET` handler returning `MatchesResponse` — consumed by `app/page.tsx` (Task 17/21), `app/schedule/page.tsx` (Task 18), `app/standings/page.tsx` (Task 26).

- [ ] **Step 1: Write the failing tests**

Create `app/api/matches/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchMuMatches: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnSchedule: vi.fn() }));

import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFdMatches = vi.mocked(fetchMuMatches);
const mockEspnSchedule = vi.mocked(fetchEspnSchedule);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/matches', () => {
  it('merges FD + ESPN and reports both sources as available on success', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: true, espn: true });
    expect(body.matches).toEqual([]);
    expect(body.season).toMatch(/^\d{4}-\d{2}$/);
  });

  it('degrades gracefully when football-data fails but ESPN succeeds', async () => {
    mockFdMatches.mockRejectedValue(new Error('FD down'));
    mockEspnSchedule.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: false, espn: true });
    expect(res.status).toBe(200);
  });

  it('degrades gracefully when every ESPN call fails but football-data succeeds', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockRejectedValue(new Error('ESPN down'));

    const res = await GET();
    const body = await res.json();

    expect(body.meta.sources).toEqual({ fd: true, espn: false });
  });

  it('serves the second call from cache without calling fetchMuMatches again', async () => {
    mockFdMatches.mockResolvedValue([]);
    mockEspnSchedule.mockResolvedValue([]);

    await GET();
    await GET();

    expect(mockFdMatches).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test app/api/matches/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/api/matches/route.ts
import { NextResponse } from 'next/server';
import { fetchMuMatches } from '@/lib/fd';
import { fetchEspnSchedule } from '@/lib/espn';
import { mergeMatches } from '@/lib/merge';
import { getCached, setCached, matchesTtlMs } from '@/lib/cache';
import { currentSeasonLabel } from '@/lib/season';
import { COMPETITIONS } from '@/lib/competitions';
import type { CompetitionId, EspnScheduleEvent, FdMatch, MatchesResponse } from '@/lib/types';

const CACHE_KEY = 'matches';

export async function GET() {
  const cached = getCached<MatchesResponse>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.FOOTBALL_API_KEY || '';

  // Promise.allSettled means one dead source degrades the response instead of failing
  // it outright — spec section 8's error-handling requirement.
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
  const response: MatchesResponse = {
    season: currentSeasonLabel(),
    matches,
    meta: {
      sources: {
        fd: fdResult.status === 'fulfilled',
        espn: espnResults.some(r => r.status === 'fulfilled'),
      },
    },
  };

  setCached(CACHE_KEY, response, matchesTtlMs(matches));
  return NextResponse.json(response);
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test app/api/matches/route.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Real-data smoke check (integration, not unit)**

Run: `npm run dev`, then in another terminal:
```bash
curl -s http://localhost:3000/api/matches | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.season, d.matches.length, d.meta.sources)"
```
Expected: prints the current season label (`2026-27`), a match count, and `{ fd: true, espn: true }` (assuming `FOOTBALL_API_KEY` in `.env.local` is valid — confirmed working live 2026-07-16 with the reused WC-2026 key: 38 PL fixtures, no CL/FA/EFL/friendly yet since ESPN/FD haven't published them this early in pre-season). Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add app/api/matches/route.ts app/api/matches/route.test.ts
git commit -m "feat: add GET /api/matches (merge FD+ESPN, cached, degrades on partial failure)"
```

---

### Task 13: `app/api/standings/route.ts`

**Files:**
- Create: `app/api/standings/route.ts`
- Test: `app/api/standings/route.test.ts`

**Interfaces:**
- Consumes: `fetchStandings` (Task 10), `getCached`/`setCached`/`STATIC_TTL_MS` (Task 7).
- Produces: `GET` handler returning `{ standings: StandingRow[] }` — consumed by `app/standings/page.tsx` (Task 26).

- [ ] **Step 1: Write the failing tests**

Create `app/api/standings/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/fd', () => ({ fetchStandings: vi.fn() }));

import { fetchStandings } from '@/lib/fd';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchStandings = vi.mocked(fetchStandings);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/standings', () => {
  it('rejects a missing/invalid comp param', async () => {
    const res = await GET(new NextRequest('http://localhost/api/standings'));
    expect(res.status).toBe(400);
  });

  it('returns the standings for a valid comp param', async () => {
    mockFetchStandings.mockResolvedValue([{ position: 1 } as never]);
    const res = await GET(new NextRequest('http://localhost/api/standings?comp=PL'));
    const body = await res.json();
    expect(body.standings).toEqual([{ position: 1 }]);
  });

  it('caches the second call for the same comp', async () => {
    mockFetchStandings.mockResolvedValue([]);
    await GET(new NextRequest('http://localhost/api/standings?comp=CL'));
    await GET(new NextRequest('http://localhost/api/standings?comp=CL'));
    expect(mockFetchStandings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test app/api/standings/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/api/standings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchStandings } from '@/lib/fd';
import { getCached, setCached, STATIC_TTL_MS } from '@/lib/cache';
import type { StandingRow } from '@/lib/types';

export async function GET(request: NextRequest) {
  const comp = request.nextUrl.searchParams.get('comp');
  if (comp !== 'PL' && comp !== 'CL') {
    return NextResponse.json({ error: 'comp must be PL or CL' }, { status: 400 });
  }

  const cacheKey = `standings:${comp}`;
  const cached = getCached<StandingRow[]>(cacheKey);
  if (cached) return NextResponse.json({ standings: cached });

  const apiKey = process.env.FOOTBALL_API_KEY || '';
  const standings = await fetchStandings(apiKey, comp);
  setCached(cacheKey, standings, STATIC_TTL_MS);
  return NextResponse.json({ standings });
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test app/api/standings/route.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Real-data smoke check**

Run: `npm run dev`, then:
```bash
curl -s "http://localhost:3000/api/standings?comp=PL" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.standings.length, d.standings[0])"
```
Expected: 20 rows, first row has `position`, `team.name`, `points`. Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add app/api/standings/route.ts app/api/standings/route.test.ts
git commit -m "feat: add GET /api/standings?comp=PL|CL"
```

---

### Task 14: `app/api/match/[id]/route.ts`

**Files:**
- Create: `app/api/match/[id]/route.ts`
- Test: `app/api/match/[id]/route.test.ts`

**Interfaces:**
- Consumes: `fetchEspnDetail` (Task 11), `getCached`/`setCached`/`LIVE_TTL_MS`/`STATIC_TTL_MS` (Task 7).
- Produces: `GET` handler returning the raw `EspnDetail` for one match. The dynamic segment `id` is the **ESPN event id** (not the opaque `Match.id` merge key — see Task 15's `MatchCard`, which builds the link as `/match/{Match.id}?espnId=...&slug=...`, so the page's own `[id]` route param stays the human-friendly merge key while this API route's `[id]` param is the ESPN event id it needs to call `/summary`). Consumed by `app/match/[id]/page.tsx` (Task 27).

- [ ] **Step 1: Write the failing tests**

Create `app/api/match/[id]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/espn', () => ({ fetchEspnDetail: vi.fn() }));

import { fetchEspnDetail } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchDetail = vi.mocked(fetchEspnDetail);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

function req(url: string) {
  return new NextRequest(url);
}

describe('GET /api/match/[id]', () => {
  it('rejects a missing slug query param', async () => {
    const res = await GET(req('http://localhost/api/match/740966'), { params: Promise.resolve({ id: '740966' }) });
    expect(res.status).toBe(400);
  });

  it('fetches ESPN detail using the route id as the event id and the slug query param', async () => {
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'post' } } }] } });
    const res = await GET(req('http://localhost/api/match/740966?slug=eng.1'), { params: Promise.resolve({ id: '740966' }) });
    expect(mockFetchDetail).toHaveBeenCalledWith('eng.1', '740966');
    expect(res.status).toBe(200);
  });

  it('caches a finished match longer than a live one', async () => {
    mockFetchDetail.mockResolvedValue({ header: { competitions: [{ status: { type: { state: 'in' } } }] } });
    await GET(req('http://localhost/api/match/1?slug=eng.1'), { params: Promise.resolve({ id: '1' }) });
    await GET(req('http://localhost/api/match/1?slug=eng.1'), { params: Promise.resolve({ id: '1' }) });
    expect(mockFetchDetail).toHaveBeenCalledTimes(1); // second call served from the 30s live cache
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test "app/api/match/[id]/route.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/api/match/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchEspnDetail } from '@/lib/espn';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import type { EspnDetail } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: espnId } = await params;
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug query param is required' }, { status: 400 });
  }

  const cacheKey = `match-detail:${slug}:${espnId}`;
  const cached = getCached<EspnDetail>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const detail = await fetchEspnDetail(slug, espnId);
  const state = detail.header?.competitions?.[0]?.status?.type?.state;
  setCached(cacheKey, detail, state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS);
  return NextResponse.json(detail);
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test "app/api/match/[id]/route.test.ts"`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Real-data smoke check**

Run: `npm run dev`, then (using the real finished-match id/slug verified live 2026-07-16):
```bash
curl -s "http://localhost:3000/api/match/740966?slug=eng.1" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.rosters?.length, d.header?.competitions?.[0]?.status?.type?.state)"
```
Expected: `2 post`. Stop the dev server after checking.

- [ ] **Step 6: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add "app/api/match/[id]/route.ts" "app/api/match/[id]/route.test.ts"
git commit -m "feat: add GET /api/match/[id] (ESPN summary: rosters, scorers, live status)"
```

---

## Milestone A — Props, lists, keys, conditional rendering

> **LEARNING.md checkpoint (Task 28 will formalize this):** this milestone is about React rendering data it's given, nothing more — no state yet inside these components. `MatchCard` only reads `props.match`; `MatchList` only maps over `props.matches`. The lesson: a component that only transforms props into JSX is trivial to test and trivial to reason about.

### Task 15: `components/MatchCard.tsx`

**Files:**
- Create: `components/MatchCard.tsx`
- Create: `components/MatchCard.module.css`
- Test: `components/MatchCard.test.tsx`

**Interfaces:**
- Consumes: `Match` (Task 4), `getCompetition` (Task 5), `isFergieTime` (Task 20 — **not built yet**; for this task, inline a local no-op `isFergieTime` stub that always returns `false`, and record a TODO comment `// replaced by the real implementation in Task 20` so Task 20 knows to import the real one instead).
- Produces: `MatchCard({ match })` — used by `components/MatchList.tsx` (Task 16).

- [ ] **Step 1: Write the failing tests**

Create `components/MatchCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchCard } from './MatchCard';
import type { Match } from '@/lib/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '2026-08-22_hullcityafc',
    utcDate: '2026-08-22T11:30:00Z',
    status: 'SCHEDULED',
    competition: 'PL',
    home: { name: 'Hull City AFC' },
    away: { name: 'Manchester United FC' },
    venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
    ...overrides,
  };
}

describe('MatchCard', () => {
  it('shows the opponent and venue from MU\'s perspective', () => {
    render(<MatchCard match={makeMatch()} />);
    expect(screen.getByText(/vs Hull City AFC \(A\)/)).toBeInTheDocument();
  });

  it('is not a link for a SCHEDULED match', () => {
    render(<MatchCard match={makeMatch({ status: 'SCHEDULED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is not a link for a TIMED match', () => {
    render(<MatchCard match={makeMatch({ status: 'TIMED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is not a link for a POSTPONED match', () => {
    render(<MatchCard match={makeMatch({ status: 'POSTPONED' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('is a link for an IN_PLAY match', () => {
    render(<MatchCard match={makeMatch({ status: 'IN_PLAY', minute: '23' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('is a link for a FINISHED match', () => {
    render(<MatchCard match={makeMatch({ status: 'FINISHED' })} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('shows HT for a PAUSED match', () => {
    render(<MatchCard match={makeMatch({ status: 'PAUSED' })} />);
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('shows FT for a FINISHED match with the display score', () => {
    render(<MatchCard match={makeMatch({
      status: 'FINISHED',
      score: { fullTime: { home: 0, away: 2 }, display: { home: 0, away: 2 } },
    })} />);
    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText('0 : 2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/MatchCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/MatchCard.module.css`:
```css
.card {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--mu-red-dark);
  border-radius: 4px;
}

.opponent {
  flex: 1;
  font-weight: 600;
}
```

Create `components/MatchCard.tsx`:
```tsx
import Link from 'next/link';
import type { Match } from '@/lib/types';
import { getCompetition } from '@/lib/competitions';
import styles from './MatchCard.module.css';

const CLICKABLE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED', 'FINISHED'];

// Replaced by the real implementation from components/LiveBadge.tsx in Task 20 — this
// stub keeps MatchCard buildable/testable before that file exists.
function isFergieTime(_match: Match): boolean {
  return false;
}

function statusLabel(match: Match): string {
  if (match.status === 'IN_PLAY') return isFergieTime(match) ? 'FERGIE TIME' : `${match.minute ?? ''}'`;
  if (match.status === 'PAUSED') return 'HT';
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'POSTPONED') return 'Postponed';
  return new Date(match.utcDate).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MatchCard({ match }: { match: Match }) {
  const opponent = match.venue === 'H' ? match.away.name : match.home.name;
  const clickable = CLICKABLE_STATUSES.includes(match.status);

  const content = (
    <div className={styles.card} data-testid="match-card">
      <span className={styles.opponent}>vs {opponent} ({match.venue})</span>
      <span>{match.score.display.home ?? '-'} : {match.score.display.away ?? '-'}</span>
      <span>{statusLabel(match)}</span>
    </div>
  );

  if (!clickable) return content;

  const slug = getCompetition(match.competition).espnSlug;
  return (
    <Link href={`/match/${match.id}?espnId=${match.sources.espn ?? ''}&slug=${slug}`}>
      {content}
    </Link>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test components/MatchCard.test.tsx`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/MatchCard.tsx components/MatchCard.module.css components/MatchCard.test.tsx
git commit -m "feat: add MatchCard (props + conditional rendering, clickable-status rule)"
```

---

### Task 16: `components/MatchList.tsx`

**Files:**
- Create: `components/MatchList.tsx`
- Test: `components/MatchList.test.tsx`

**Interfaces:**
- Consumes: `Match` (Task 4), `MatchCard` (Task 15).
- Produces: `MatchList({ matches, emptyLabel? })` — used by `app/page.tsx` (Task 17), `app/schedule/page.tsx` (Task 18).

- [ ] **Step 1: Write the failing tests**

Create `components/MatchList.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchList } from './MatchList';
import type { Match } from '@/lib/types';

function makeMatch(id: string, opponent: string): Match {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition: 'PL',
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('MatchList', () => {
  it('renders one card per match, in order', () => {
    render(<MatchList matches={[makeMatch('a', 'Manchester United FC'), makeMatch('b', 'Everton FC')]} />);
    const cards = screen.getAllByTestId('match-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Manchester United FC');
    expect(cards[1]).toHaveTextContent('Everton FC');
  });

  it('shows the empty-state label when there are no matches', () => {
    render(<MatchList matches={[]} emptyLabel="Nothing to see here" />);
    expect(screen.getByText('Nothing to see here')).toBeInTheDocument();
  });

  it('falls back to a default empty-state label', () => {
    render(<MatchList matches={[]} />);
    expect(screen.getByTestId('match-list-empty')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/MatchList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/MatchList.tsx
import type { Match } from '@/lib/types';
import { MatchCard } from './MatchCard';

export function MatchList({ matches, emptyLabel = 'No matches' }: { matches: Match[]; emptyLabel?: string }) {
  if (matches.length === 0) {
    return <p data-testid="match-list-empty">{emptyLabel}</p>;
  }
  return (
    <ul data-testid="match-list">
      {matches.map(match => (
        // [React] key must be stable and unique per item so React can match old/new DOM
        // nodes across re-renders instead of tearing everything down and rebuilding it —
        // Match.id (day + normalized opponent) is stable across polls, unlike array index.
        <li key={match.id}>
          <MatchCard match={match} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test components/MatchList.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/MatchList.tsx components/MatchList.test.tsx
git commit -m "feat: add MatchList (list rendering with stable keys, empty state)"
```

---

### Task 17: `app/page.tsx` — Today page (fetch-once wiring)

**Files:**
- Modify: `app/page.tsx`
- Test: `app/page.test.tsx`

**Interfaces:**
- Consumes: `MatchesResponse` (Task 4), `MatchList` (Task 16), `GET /api/matches` (Task 12).
- Produces: the Today page. **This will be rewritten in Task 21** to use `usePolling` instead of the plain `useEffect` below — that's intentional: this task teaches the naive fetch-once effect (including its own cleanup, a first taste of the concept before Task 19 generalizes it into a hook).

- [ ] **Step 1: Write the failing tests**

Create `app/page.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TodayPage from './page';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function response(matches: MatchesResponse['matches']): MatchesResponse {
  return { season: '2026-27', matches, meta: { sources: { fd: true, espn: true } } };
}

describe('TodayPage', () => {
  it('shows a loading state before the fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<TodayPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows only matches scheduled for today, from MU\'s perspective', async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => response([
        { id: 't', utcDate: `${today}T15:00:00Z`, status: 'SCHEDULED', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 1 } },
        { id: 'later', utcDate: '2099-01-01T15:00:00Z', status: 'SCHEDULED', competition: 'PL', home: { name: 'Everton FC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 2 } },
      ]),
    }));

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/Hull City/)).toBeInTheDocument());
    expect(screen.queryByText(/Everton/)).not.toBeInTheDocument();
  });

  it('shows an error message if the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<TodayPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test app/page.test.tsx`
Expected: FAIL — default Next.js starter page doesn't fetch or render a match list.

- [ ] **Step 3: Implement**

Replace `app/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { MatchesResponse } from '@/lib/types';
import { MatchList } from '@/components/MatchList';

export default function TodayPage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // [React] `cancelled` guards against setting state after this effect's cleanup has
    // already run (e.g. the user navigated away before the fetch resolved) — without it,
    // React warns about updating an unmounted component and you can get a stale write.
    let cancelled = false;
    fetch('/api/matches')
      .then(res => res.json())
      .then((json: MatchesResponse) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setError('Failed to load matches'); });
    return () => { cancelled = true; };
  }, []); // [React] empty dependency array = run once after the first render, like componentDidMount.

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMatches = data.matches.filter(m => m.utcDate.slice(0, 10) === todayKey);

  return (
    <main>
      <h1>Today</h1>
      <MatchList matches={todayMatches} emptyLabel="No Manchester United match today" />
    </main>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test app/page.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: add Today page (fetch-once useEffect wiring to /api/matches)"
```

---

## Milestone B — State and lifting state up

> **LEARNING.md checkpoint:** `CompetitionFilterPills` below owns no state at all — it's "controlled" (`selected`/`onSelect` are props). The Schedule page owns the one piece of state both the pills and the list need, and passes it down to both. This is "lifting state up": when two sibling components need to share data, the state moves to their nearest common parent instead of living in either sibling.

### Task 18: `components/CompetitionFilterPills.tsx` + `app/schedule/page.tsx`

**Files:**
- Create: `components/CompetitionFilterPills.tsx`
- Test: `components/CompetitionFilterPills.test.tsx`
- Create: `app/schedule/page.tsx`
- Test: `app/schedule/page.test.tsx`

**Interfaces:**
- Consumes: `CompetitionId` (Task 4), `COMPETITIONS` (Task 5), `MatchList` (Task 16), `MatchesResponse` (Task 4).
- Produces: `CompetitionFilterPills({ selected, onSelect })`, the `FilterValue` type (`CompetitionId | 'ALL'`) — reused by `contexts/CompetitionFilterContext.tsx` (Task 22).

- [ ] **Step 1: Write the failing test for the pills component**

Create `components/CompetitionFilterPills.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompetitionFilterPills } from './CompetitionFilterPills';

describe('CompetitionFilterPills', () => {
  it('renders an All tab plus one per competition', () => {
    render(<CompetitionFilterPills selected="ALL" onSelect={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(6); // All + PL + CL + FA + EFL + Friendly
  });

  it('marks the selected tab as aria-selected', () => {
    render(<CompetitionFilterPills selected="PL" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Premier League' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect with the clicked competition id, not internal state', async () => {
    const onSelect = vi.fn();
    render(<CompetitionFilterPills selected="ALL" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Premier League' }));
    expect(onSelect).toHaveBeenCalledWith('PL');
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/CompetitionFilterPills.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pills**

```tsx
// components/CompetitionFilterPills.tsx
import type { CompetitionId } from '@/lib/types';
import { COMPETITIONS } from '@/lib/competitions';

export type FilterValue = CompetitionId | 'ALL';

// [React] This component holds no useState — it's fully "controlled" by its parent via
// `selected`/`onSelect` props. That's what makes lifting state up possible: the parent
// (or later, a Context provider) owns the one source of truth, and every consumer of it
// re-renders in sync automatically.
export function CompetitionFilterPills({ selected, onSelect }: { selected: FilterValue; onSelect: (value: FilterValue) => void }) {
  return (
    <div role="tablist" aria-label="Filter by competition">
      <button role="tab" aria-selected={selected === 'ALL'} onClick={() => onSelect('ALL')}>All</button>
      {COMPETITIONS.map(c => (
        <button key={c.id} role="tab" aria-selected={selected === c.id} onClick={() => onSelect(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run and see the pills tests pass**

Run: `npm test components/CompetitionFilterPills.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit the pills**

```bash
git add components/CompetitionFilterPills.tsx components/CompetitionFilterPills.test.tsx
git commit -m "feat: add CompetitionFilterPills (controlled component, no internal state)"
```

- [ ] **Step 6: Write the failing test for the Schedule page**

Create `app/schedule/page.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from './page';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => vi.unstubAllGlobals());

function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string): MatchesResponse['matches'][number] {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('SchedulePage', () => {
  it('shows all matches by default, then filters when a pill is clicked (lifted state)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Manchester United FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));

    await userEvent.click(screen.getByRole('tab', { name: 'Friendly' }));

    expect(screen.getAllByTestId('match-card')).toHaveLength(1);
    expect(screen.getByText(/Leeds United/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run and see it fail**

Run: `npm test app/schedule/page.test.tsx`
Expected: FAIL — route doesn't exist.

- [ ] **Step 8: Implement the Schedule page**

Create `app/schedule/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { CompetitionFilterPills, type FilterValue } from '@/components/CompetitionFilterPills';
import { MatchList } from '@/components/MatchList';

export default function SchedulePage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  // [React] This state lives here — the nearest common parent of the pills and the list
  // below — because both siblings need to read/change it. Neither MatchList nor
  // CompetitionFilterPills owns it themselves.
  const [selected, setSelected] = useState<FilterValue>('ALL');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/matches').then(res => res.json()).then((json: MatchesResponse) => {
      if (!cancelled) setData(json);
    });
    return () => { cancelled = true; };
  }, []);

  if (!data) return <p>Loading...</p>;

  const filtered: typeof data.matches = selected === 'ALL'
    ? data.matches
    : data.matches.filter(m => m.competition === (selected as CompetitionId));

  return (
    <main>
      <h1>Schedule</h1>
      <CompetitionFilterPills selected={selected} onSelect={setSelected} />
      <MatchList matches={filtered} emptyLabel="No matches for this competition" />
    </main>
  );
}
```

- [ ] **Step 9: Run and see it pass**

Run: `npm test app/schedule/page.test.tsx`
Expected: PASS — 1 test passed.

- [ ] **Step 10: Commit**

```bash
git add app/schedule/page.tsx app/schedule/page.test.tsx
git commit -m "feat: add Schedule page (lifting filter state up to the common parent)"
```

---

## Milestone C — `useEffect`, cleanup, refs (`usePolling`)

> **LEARNING.md checkpoint:** this is the milestone the user most wanted to understand deeply. `usePolling` is deliberately hand-written instead of using a library, so every mechanism is visible: the interval is created in an effect and destroyed in that effect's cleanup function; a `cancelled` flag stops a stale in-flight fetch from calling `setState` after a newer one already has (or after unmount); a `ref` holds the latest fetcher so the effect doesn't need to depend on a function whose identity changes every render — a very common real-world gotcha.

### Task 19: `hooks/usePolling.ts` + `lib/polling.ts`

**Files:**
- Create: `lib/polling.ts`
- Test: `lib/polling.test.ts`
- Create: `hooks/usePolling.ts`
- Test: `hooks/usePolling.test.ts`

**Interfaces:**
- Consumes: `Match` (Task 4).
- Produces: `pollingIntervalForMatches(matches, now?)`, `LIVE_POLL_MS`, `NEAR_KICKOFF_POLL_MS`; `usePolling<T>(fetcher, intervalMs)` returning `{ data, error, loading, refetch }` — used by `app/page.tsx` (Task 21), `app/match/[id]/page.tsx` (Task 27).

- [ ] **Step 1: Write the failing tests for `pollingIntervalForMatches`**

Create `lib/polling.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pollingIntervalForMatches, LIVE_POLL_MS, NEAR_KICKOFF_POLL_MS } from './polling';

const now = new Date('2026-08-22T11:00:00Z').getTime();

describe('pollingIntervalForMatches', () => {
  it('returns the live interval when a match is IN_PLAY', () => {
    expect(pollingIntervalForMatches([{ status: 'IN_PLAY', utcDate: '' }], now)).toBe(LIVE_POLL_MS);
  });

  it('returns the live interval when a match is PAUSED', () => {
    expect(pollingIntervalForMatches([{ status: 'PAUSED', utcDate: '' }], now)).toBe(LIVE_POLL_MS);
  });

  it('returns the near-kickoff interval when a SCHEDULED match starts within 30 minutes', () => {
    expect(pollingIntervalForMatches([{ status: 'SCHEDULED', utcDate: '2026-08-22T11:20:00Z' }], now)).toBe(NEAR_KICKOFF_POLL_MS);
  });

  it('returns null when nothing is live or imminent', () => {
    expect(pollingIntervalForMatches([{ status: 'FINISHED', utcDate: '2026-08-20T11:00:00Z' }], now)).toBeNull();
  });

  it('returns null for an empty match list', () => {
    expect(pollingIntervalForMatches([], now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/polling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/polling.ts
import type { Match } from './types';

export const LIVE_POLL_MS = 30_000;
export const NEAR_KICKOFF_POLL_MS = 5 * 60_000;
const NEAR_KICKOFF_WINDOW_MS = 30 * 60_000;

export function pollingIntervalForMatches(
  matches: Array<Pick<Match, 'status' | 'utcDate'>>,
  now: number = Date.now(),
): number | null {
  if (matches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return LIVE_POLL_MS;

  const nearKickoff = matches.some(m => {
    if (m.status !== 'SCHEDULED' && m.status !== 'TIMED') return false;
    const t = new Date(m.utcDate).getTime();
    return !Number.isNaN(t) && Math.abs(t - now) < NEAR_KICKOFF_WINDOW_MS;
  });
  return nearKickoff ? NEAR_KICKOFF_POLL_MS : null;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/polling.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/polling.ts lib/polling.test.ts
git commit -m "feat: add pollingIntervalForMatches (live=30s, near-kickoff=5min, else off)"
```

- [ ] **Step 6: Write the failing tests for `usePolling`**

Create `hooks/usePolling.test.ts`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { usePolling } from './usePolling';

function Probe({ fetcher, intervalMs }: { fetcher: () => Promise<string>; intervalMs: number | null }) {
  const { data, error, loading } = usePolling(fetcher, intervalMs);
  return <div>{loading ? 'loading' : error ? `error:${error.message}` : `data:${data}`}</div>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePolling', () => {
  it('fetches once immediately on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue('first');
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText('data:first')).toBeInTheDocument();
  });

  it('does not schedule another fetch when intervalMs is null', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches on the given interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('clears the interval on unmount (no further fetches)', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { unmount } = render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected fetch as an error without crashing', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    render(<Probe fetcher={fetcher} intervalMs={null} />);
    await waitFor(() => expect(screen.getByText('error:boom')).toBeInTheDocument());
  });

  it('restarts the interval when intervalMs changes', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { rerender } = render(<Probe fetcher={fetcher} intervalMs={1000} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender(<Probe fetcher={fetcher} intervalMs={5000} />);
    await act(async () => { await Promise.resolve(); });

    // Old 1000ms interval must be gone — advancing by 1000ms alone must NOT refetch.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // New 5000ms interval fires (4000ms remaining after the 1000ms already advanced).
    await act(async () => { vi.advanceTimersByTime(4000); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 7: Run and see it fail**

Run: `npm test hooks/usePolling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement**

Create `hooks/usePolling.ts`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number | null): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // [React] Stores the latest fetcher without putting it in the effect's dependency
  // array. Inline functions get a new identity every render — if `fetcher` itself were a
  // dependency, the effect (and its setInterval) would tear down and rebuild on every
  // single render, not just when intervalMs actually changes. This ref sidesteps that.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    // [React] `cancelled` is this run's private flag. If intervalMs changes (or the
    // component unmounts) before an in-flight fetch resolves, its result is discarded
    // instead of overwriting newer state.
    let cancelled = false;

    async function run() {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    if (intervalMs === null) {
      return () => { cancelled = true; };
    }

    const id = setInterval(run, intervalMs);
    // [React] The cleanup function runs before the next effect (when intervalMs
    // changes) and on unmount — this is the only place the interval is ever cleared,
    // which is what prevents a leaked timer from firing after the component is gone.
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { data, error, loading };
}
```

- [ ] **Step 9: Run and see it pass**

Run: `npm test hooks/usePolling.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 10: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add hooks/usePolling.ts hooks/usePolling.test.ts
git commit -m "feat: add usePolling (hand-written interval hook: cleanup, ref, cancelled-flag)"
```

---

### Task 20: `components/LiveBadge.tsx` — `isFergieTime`

**Files:**
- Create: `components/LiveBadge.tsx`
- Test: `components/LiveBadge.test.tsx`
- Modify: `components/MatchCard.tsx` (swap the Task 15 stub for the real import)
- Modify: `components/MatchCard.test.tsx` (add a Fergie Time case)

**Interfaces:**
- Consumes: `Match` (Task 4).
- Produces: `isFergieTime(match)`, `LiveBadge({ match })` — `isFergieTime` replaces the stub in `components/MatchCard.tsx` (Task 15).

- [ ] **Step 1: Write the failing tests**

Create `components/LiveBadge.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveBadge, isFergieTime } from './LiveBadge';
import type { Match } from '@/lib/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'x', utcDate: '2026-08-22T11:30:00Z', status: 'IN_PLAY', competition: 'PL',
    home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A',
    score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } },
    minute: '90', sources: { fd: 1 },
    ...overrides,
  };
}

describe('isFergieTime', () => {
  it('is true at minute 90+ while MU is drawing away', () => {
    expect(isFergieTime(makeMatch({ venue: 'A', minute: '90', score: { fullTime: { home: 1, away: 1 }, display: { home: 1, away: 1 } } }))).toBe(true);
  });

  it('is true at minute 90+ while MU is losing at home', () => {
    expect(isFergieTime(makeMatch({ venue: 'H', minute: "90'+2'", score: { fullTime: { home: 0, away: 1 }, display: { home: 0, away: 1 } } }))).toBe(true);
  });

  it('is false while MU is winning', () => {
    expect(isFergieTime(makeMatch({ venue: 'H', minute: '90', score: { fullTime: { home: 2, away: 0 }, display: { home: 2, away: 0 } } }))).toBe(false);
  });

  it('is false before minute 90', () => {
    expect(isFergieTime(makeMatch({ minute: '75' }))).toBe(false);
  });

  it('is false when the match is not IN_PLAY', () => {
    expect(isFergieTime(makeMatch({ status: 'PAUSED' }))).toBe(false);
  });
});

describe('LiveBadge', () => {
  it('renders HT for a PAUSED match', () => {
    render(<LiveBadge match={makeMatch({ status: 'PAUSED' })} />);
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('renders FERGIE TIME when isFergieTime is true', () => {
    render(<LiveBadge match={makeMatch({ venue: 'H', minute: '91', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } } })} />);
    expect(screen.getByText('FERGIE TIME')).toBeInTheDocument();
  });

  it('renders the plain minute when not Fergie Time', () => {
    render(<LiveBadge match={makeMatch({ minute: '40' })} />);
    expect(screen.getByText("40'")).toBeInTheDocument();
  });

  it('renders nothing for a non-live match', () => {
    const { container } = render(<LiveBadge match={makeMatch({ status: 'FINISHED' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/LiveBadge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/LiveBadge.tsx
import type { Match } from '@/lib/types';

// MU flavor: minute 90+ while drawing or losing gets a distinct badge — a nod to
// stoppage-time drama, not a football-data/ESPN concept. `parseInt` on "90'+3'" stops at
// the first non-digit character and correctly returns 90.
export function isFergieTime(match: Match): boolean {
  if (match.status !== 'IN_PLAY') return false;
  const minute = parseInt(match.minute || '', 10);
  if (Number.isNaN(minute) || minute < 90) return false;
  const muScore = match.venue === 'H' ? match.score.display.home : match.score.display.away;
  const oppScore = match.venue === 'H' ? match.score.display.away : match.score.display.home;
  if (muScore === null || oppScore === null) return false;
  return muScore <= oppScore;
}

export function LiveBadge({ match }: { match: Match }) {
  if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return null;
  if (match.status === 'PAUSED') return <span className="badge-ht">HT</span>;
  if (isFergieTime(match)) return <span className="badge-fergie">FERGIE TIME</span>;
  return <span className="badge-live">{match.minute}&apos;</span>;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test components/LiveBadge.test.tsx`
Expected: PASS — 9 tests passed.

- [ ] **Step 5: Wire the real `isFergieTime` into MatchCard**

Edit `components/MatchCard.tsx` — remove the local stub and import the real one:
```tsx
import Link from 'next/link';
import type { Match } from '@/lib/types';
import { getCompetition } from '@/lib/competitions';
import { isFergieTime } from './LiveBadge';
import styles from './MatchCard.module.css';
```
Delete the `function isFergieTime(_match: Match): boolean { return false; }` stub block entirely — the imported one replaces it, and `statusLabel` needs no other change.

- [ ] **Step 6: Add a regression test proving the wiring**

Append to `components/MatchCard.test.tsx`:
```tsx
it('shows FERGIE TIME instead of the minute when MU is not winning in the 90th', () => {
  render(<MatchCard match={makeMatch({
    status: 'IN_PLAY', minute: '90', venue: 'H',
    score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } },
  })} />);
  expect(screen.getByText('FERGIE TIME')).toBeInTheDocument();
});
```

- [ ] **Step 7: Run both suites and see everything pass**

Run: `npm test components/MatchCard.test.tsx components/LiveBadge.test.tsx`
Expected: PASS — 9 + 9 tests passed.

- [ ] **Step 8: Commit**

```bash
git add components/LiveBadge.tsx components/LiveBadge.test.tsx components/MatchCard.tsx components/MatchCard.test.tsx
git commit -m "feat: add Fergie Time badge, wire it into MatchCard"
```

---

### Task 21: Wire the Today page to `usePolling` (replaces Task 17's fetch-once effect)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: `usePolling` (Task 19), `pollingIntervalForMatches` (Task 19), `MatchesResponse` (Task 4).
- Produces: the final Today page — live-polling with a dynamic interval, a "stale data" banner on refetch error, and a partial-source banner.

- [ ] **Step 1: Replace the page test's fetch-once assumptions**

Replace `app/page.test.tsx` entirely — the old plain-`useEffect` version (Task 17) assumed exactly one fetch; this version polls, so tests must use fake timers:
```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import TodayPage from './page';
import type { MatchesResponse } from '@/lib/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function response(overrides: Partial<MatchesResponse> = {}): MatchesResponse {
  return { season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } }, ...overrides };
}

describe('TodayPage', () => {
  it('shows a loading state before the first fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<TodayPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows only today\'s matches from the fetched data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response({ matches: [
        { id: 't', utcDate: `${today}T15:00:00Z`, status: 'SCHEDULED', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: null, away: null }, display: { home: null, away: null } }, sources: { fd: 1 } },
      ] }),
    }));

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Hull City/)).toBeInTheDocument();
  });

  it('shows a partial-source banner when ESPN enrichment is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ meta: { sources: { fd: true, espn: false } } }),
    }));

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/ESPN enrichment unavailable/)).toBeInTheDocument();
  });

  it('keeps showing the last known data and a retry banner when a later poll fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => response({ matches: [
        { id: 't', utcDate: '2026-08-22T15:00:00Z', status: 'IN_PLAY', competition: 'PL', home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A', score: { fullTime: { home: 0, away: 0 }, display: { home: 0, away: 0 } }, minute: '10', sources: { fd: 1 } },
      ] }) })
      .mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    render(<TodayPage />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A live match sets the interval to 30s (LIVE_POLL_MS) — advance past it.
    await act(async () => { vi.advanceTimersByTime(30_000); await Promise.resolve(); });

    expect(screen.getByRole('alert')).toHaveTextContent(/refresh failed/i);
    // Old data must still be visible, not replaced by a blank/error page.
    expect(screen.getByText(/Manchester United FC/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test app/page.test.tsx`
Expected: FAIL — the Task 17 fetch-once page has no polling, no banners.

- [ ] **Step 3: Implement**

Replace `app/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { pollingIntervalForMatches } from '@/lib/polling';
import { MatchList } from '@/components/MatchList';
import type { MatchesResponse } from '@/lib/types';

async function fetchMatches(): Promise<MatchesResponse> {
  const res = await fetch('/api/matches');
  if (!res.ok) throw new Error('Failed to load matches');
  return res.json();
}

export default function TodayPage() {
  // 5 minutes is a safe default before we know whether anything is live; once the first
  // response arrives, the effect below recomputes the real interval.
  const [intervalMs, setIntervalMs] = useState<number | null>(300_000);
  const { data, error } = usePolling(fetchMatches, intervalMs);

  // [React] This effect reacts to `data` changing (a state update from the usePolling
  // hook above) by triggering *another* state update (setIntervalMs), which in turn
  // changes usePolling's own intervalMs prop and restarts its interval effect. Chaining
  // effects like this is a normal, if easy-to-miss, React pattern — see LEARNING.md.
  useEffect(() => {
    if (data) setIntervalMs(pollingIntervalForMatches(data.matches));
  }, [data]);

  if (error && !data) return <p role="alert">{error.message}</p>;
  if (!data) return <p>Loading...</p>;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMatches = data.matches.filter(m => m.utcDate.slice(0, 10) === todayKey);

  return (
    <main>
      <h1>Today</h1>
      {error && <p role="alert">Showing last known data — refresh failed</p>}
      {!data.meta.sources.espn && <p role="status">ESPN enrichment unavailable — showing football-data only</p>}
      <MatchList matches={todayMatches} emptyLabel="No Manchester United match today" />
    </main>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test app/page.test.tsx`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: wire Today page to usePolling (dynamic interval, stale-data + partial-source banners)"
```

---

## Milestone D — Context

> **LEARNING.md checkpoint:** Task 18 lifted state up to the Schedule page because both siblings that needed it (`CompetitionFilterPills`, `MatchList`) lived inside that one page. Here the *same* filter needs to live in the shared `layout.tsx` nav (visible on every page) and be read by the Schedule page — two components that are **not** in a parent/child relationship from React's point of view (a Next.js layout renders a page via `{children}`, it cannot hand that page extra props directly). That's the actual trigger for Context: not "global state is nice," but "prop-passing has nowhere to go." Reach for it when lifting state up would require threading a prop through a component that doesn't otherwise need it.

### Task 22: `contexts/CompetitionFilterContext.tsx` + `app/layout.tsx` nav

**Files:**
- Create: `contexts/CompetitionFilterContext.tsx`
- Test: `contexts/CompetitionFilterContext.test.tsx`
- Create: `components/NavFilterPills.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/schedule/page.tsx` (consume context instead of local state)
- Modify: `app/schedule/page.test.tsx`

**Interfaces:**
- Consumes: `FilterValue`, `CompetitionFilterPills` (Task 18).
- Produces: `CompetitionFilterProvider`, `useCompetitionFilter()` — consumed by `components/NavFilterPills.tsx` and `app/schedule/page.tsx` here, and available to any future page needing the same filter.

- [ ] **Step 1: Write the failing test for the context**

Create `contexts/CompetitionFilterContext.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompetitionFilterProvider, useCompetitionFilter } from './CompetitionFilterContext';

function ReaderA() {
  const { selected } = useCompetitionFilter();
  return <span data-testid="reader-a">{selected}</span>;
}

function WriterB() {
  const { setSelected } = useCompetitionFilter();
  return <button onClick={() => setSelected('CL')}>set CL</button>;
}

describe('CompetitionFilterContext', () => {
  it('starts at ALL', () => {
    render(<CompetitionFilterProvider><ReaderA /></CompetitionFilterProvider>);
    expect(screen.getByTestId('reader-a')).toHaveTextContent('ALL');
  });

  it('lets one consumer\'s update be seen by a sibling consumer, without any prop passed between them', async () => {
    render(
      <CompetitionFilterProvider>
        <ReaderA />
        <WriterB />
      </CompetitionFilterProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'set CL' }));
    expect(screen.getByTestId('reader-a')).toHaveTextContent('CL');
  });

  it('throws if useCompetitionFilter is called outside the provider', () => {
    function Bare() {
      useCompetitionFilter();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/CompetitionFilterProvider/);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test contexts/CompetitionFilterContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `contexts/CompetitionFilterContext.tsx`:
```tsx
'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { FilterValue } from '@/components/CompetitionFilterPills';

interface CompetitionFilterContextValue {
  selected: FilterValue;
  setSelected: (value: FilterValue) => void;
}

const CompetitionFilterContext = createContext<CompetitionFilterContextValue | null>(null);

export function CompetitionFilterProvider({ children }: { children: ReactNode }) {
  // [React] The Provider owns the one piece of state; every consumer below it in the
  // tree reads the same value via useContext and re-renders when it changes — no props
  // threaded through layout.tsx or any intermediate component.
  const [selected, setSelected] = useState<FilterValue>('ALL');
  return (
    <CompetitionFilterContext.Provider value={{ selected, setSelected }}>
      {children}
    </CompetitionFilterContext.Provider>
  );
}

export function useCompetitionFilter(): CompetitionFilterContextValue {
  const ctx = useContext(CompetitionFilterContext);
  if (!ctx) throw new Error('useCompetitionFilter must be used within CompetitionFilterProvider');
  return ctx;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test contexts/CompetitionFilterContext.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit the context**

```bash
git add contexts/CompetitionFilterContext.tsx contexts/CompetitionFilterContext.test.tsx
git commit -m "feat: add CompetitionFilterContext (shared filter across layout nav and pages)"
```

- [ ] **Step 6: Add the thin nav wrapper**

Create `components/NavFilterPills.tsx`:
```tsx
'use client';
import { CompetitionFilterPills } from './CompetitionFilterPills';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';

export function NavFilterPills() {
  const { selected, setSelected } = useCompetitionFilter();
  return <CompetitionFilterPills selected={selected} onSelect={setSelected} />;
}
```

- [ ] **Step 7: Wire the provider and nav into the root layout**

Replace `app/layout.tsx`:
```tsx
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
```

- [ ] **Step 8: Update the Schedule page to consume context instead of local state**

Replace `app/schedule/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';
import { MatchList } from '@/components/MatchList';

export default function SchedulePage() {
  const { selected } = useCompetitionFilter();
  const [data, setData] = useState<MatchesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/matches').then(res => res.json()).then((json: MatchesResponse) => {
      if (!cancelled) setData(json);
    });
    return () => { cancelled = true; };
  }, []);

  if (!data) return <p>Loading...</p>;
  const filtered: typeof data.matches = selected === 'ALL'
    ? data.matches
    : data.matches.filter(m => m.competition === (selected as CompetitionId));

  return (
    <main>
      <h1>Schedule</h1>
      <MatchList matches={filtered} emptyLabel="No matches for this competition" />
    </main>
  );
}
```

- [ ] **Step 9: Update the Schedule page test to wrap in the provider**

Edit `app/schedule/page.test.tsx` — import and wrap with the provider, and drop the pill-click assertion in favor of asserting the page reads context (the pills now live in the layout, not the page):
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SchedulePage from './page';
import { CompetitionFilterProvider } from '@/contexts/CompetitionFilterContext';
import type { MatchesResponse } from '@/lib/types';

afterEach(() => vi.unstubAllGlobals());

function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string): MatchesResponse['matches'][number] {
  return {
    id, utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: opponent }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('SchedulePage', () => {
  it('shows all matches by default (ALL from the shared context)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Manchester United FC'), match('b', 'FRIENDLY', 'Leeds United')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<CompetitionFilterProvider><SchedulePage /></CompetitionFilterProvider>);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
  });
});
```

The pill-click-filters-the-list behavior is now an integration between `NavFilterPills` (in the layout) and `SchedulePage` (consuming the same context) rather than something `SchedulePage` alone can demonstrate in isolation — that cross-component wiring is exactly what Step 10 verifies manually.

- [ ] **Step 10: Run the full test suite, then manually verify the cross-component wiring**

Run: `npm test`
Expected: all suites pass.

Run: `npm run dev`, open `http://localhost:3000/schedule` in a browser, click a competition pill in the header nav, and confirm the match list below updates — this is the one behavior no unit test covers end-to-end (the pill lives in the layout, the list lives in the page, and only the browser renders both together). Stop the dev server after checking.

- [ ] **Step 11: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add components/NavFilterPills.tsx app/layout.tsx app/schedule/page.tsx app/schedule/page.test.tsx
git commit -m "feat: promote competition filter to Context, move pills into the shared nav"
```

---

## Milestone E — Derived state and `useMemo`

> **LEARNING.md checkpoint:** `CupRun` (Task 25) derives its rounds by filtering/sorting `matches` fresh on every render — cheap, so no memoization. `FormationPitch` (Task 24) calls `buildFormationRows`, a heavier sort-and-group operation, and wraps it in `useMemo` keyed on the roster/formation — so it doesn't re-run on every re-render of the match-detail page (e.g. every 30s live-poll tick from `usePolling`), only when the roster data actually changes. The contrast is the lesson: `useMemo` is a targeted fix for a real recomputation cost, not a default to reach for on every derived value.

### Task 23: `lib/formation.ts`

**Files:**
- Create: `lib/formation.ts`
- Test: `lib/formation.test.ts`

**Interfaces:**
- Consumes: `EspnRosterPlayer` (Task 4).
- Produces: `buildFormationRows(roster, formation)` — used by `components/FormationPitch.tsx` (Task 24).

- [ ] **Step 1: Write the failing tests**

Create `lib/formation.test.ts`. The starter fixture mirrors the real Brighton XI shape (verified live 2026-07-16, event 740966) trimmed to what `buildFormationRows` reads:
```ts
import { describe, it, expect } from 'vitest';
import { buildFormationRows } from './formation';
import type { EspnRosterPlayer } from './types';

function player(name: string, abbrev: string, formationPlace: string, starter = true): EspnRosterPlayer {
  return { starter, formationPlace, position: { abbreviation: abbrev }, athlete: { displayName: name } };
}

describe('buildFormationRows', () => {
  it('groups a 4-2-3-1 XI into 5 rows of size 1,4,2,3,1', () => {
    const roster: EspnRosterPlayer[] = [
      player('Verbruggen', 'G', '1'),
      player('Van Hecke', 'CD-R', '5'), player('Milambo', 'CD-C', '4'), player('Igor', 'CD-L', '6'), player('Lamptey', 'RB', '2'),
      player('Ayari', 'DM', '8'), player('Baleba', 'DM', '9'),
      player('Wieffer', 'AM-R', '7'), player('Minteh', 'AM-C', '10'), player('Rutter', 'AM-L', '11'),
      player('Welbeck', 'F', '3'),
    ];
    const rows = buildFormationRows(roster, '4-2-3-1');
    expect(rows.map(r => r.length)).toEqual([1, 4, 2, 3, 1]);
    expect(rows[0][0].athlete?.displayName).toBe('Verbruggen');
  });

  it('excludes non-starters', () => {
    const roster: EspnRosterPlayer[] = [
      player('Verbruggen', 'G', '1'),
      player('Sub', 'F', '20', false),
    ];
    const rows = buildFormationRows(roster, '4-2-3-1');
    const names = rows.flat().map(p => p.athlete?.displayName);
    expect(names).not.toContain('Sub');
  });

  it('returns a single empty row for an empty/undefined roster instead of throwing', () => {
    expect(buildFormationRows(undefined, undefined)).toEqual([[]]);
    expect(buildFormationRows([], '4-3-3')).toEqual([[]]);
  });

  it('sorts a row using the -L/-R suffix on the abbreviation (right before left)', () => {
    const roster: EspnRosterPlayer[] = [
      player('GK', 'G', '1'),
      player('Left Back', 'LB', '3'), player('Right Back', 'RB', '2'), player('CB1', 'CD-R', '5'), player('CB2', 'CD-L', '6'),
    ];
    const rows = buildFormationRows(roster, '4');
    const backLine = rows[1].map(p => p.athlete?.displayName);
    expect(backLine.indexOf('Right Back')).toBeLessThan(backLine.indexOf('Left Back'));
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test lib/formation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Ported line-for-line from `WC-2026-live-tracker/utils.js`'s `buildFormationRows`/`playerLine`/`widthRank`/`FP_LAT`, retyped for TypeScript, with one deliberate change: an empty roster now returns `[[]]` instead of `[[undefined]]` (the original JS pushed `[players[0]]` unconditionally, which is `[undefined]` when `players` is empty — friendlies with no published lineup must degrade to an empty pitch, not crash; spec section 8):
```ts
// lib/formation.ts
import type { EspnRosterPlayer } from './types';

// Maps traditional jersey-based formationPlace (1–11) to a lateral slot. Negative = right
// side of the pitch, positive = left, 0 = center. Matches classic numbering: #2=RB,
// #3=LB, #5=RCB, #6=LCB, #7=RW, #11=LW.
const FP_LAT: Record<number, number> = { 1: 0, 2: -2, 3: 2, 4: 0.5, 5: -1, 6: 1, 7: -2, 8: -0.5, 9: 0, 10: 0, 11: 2 };

// Determine which vertical line a player belongs to. ESPN suffixes side-specific
// abbreviations with -L/-R (e.g. CD-L, AM-R), so checks use startsWith/endsWith rather
// than exact match. formationPlace is used only as a last resort.
function playerLine(p: EspnRosterPlayer): number {
  const a = (p.position?.abbreviation || '').toUpperCase();
  const fp = Number(p.formationPlace);
  if (a === 'G' || a === 'GK') return 0;
  if (a.endsWith('B') || a.startsWith('CD') || a === 'D' || a === 'SW') return 1;
  if (a.includes('DM')) return 2;
  if (a === 'F' || a.endsWith('F')) return 5;
  if (a === 'LW' || a === 'RW') return 4;
  if (a.includes('AM')) return 4;
  if (a.includes('M')) return 3;
  if (fp === 7 || fp === 11) return 4;
  return 5;
}

// Horizontal slot within a line: leading R/L = wide (±2), trailing -R/-L = inner (±1).
function widthRank(a: string): number {
  if (/^R/.test(a)) return -2;
  if (/^L/.test(a)) return 2;
  if (/R$/.test(a)) return -1;
  if (/L$/.test(a)) return 1;
  return 0;
}

export function buildFormationRows(
  roster: EspnRosterPlayer[] | undefined,
  formation: string | undefined,
): EspnRosterPlayer[][] {
  const players = (roster || [])
    .filter(p => p.starter)
    .map(p => ({ p, line: playerLine(p), fp: Number(p.formationPlace) || 99 }))
    .sort((x, y) => x.line - y.line || x.fp - y.fp)
    .map(r => r.p);

  // The abbreviation's own -L/-R marker is authoritative when present; FP_LAT is a
  // fallback for side-less abbreviations (CM, F, AM…).
  const fpLat = (p: EspnRosterPlayer): number => {
    const w = widthRank((p.position?.abbreviation || '').toUpperCase());
    if (w !== 0) return w;
    const n = Number(p.formationPlace);
    return n in FP_LAT ? FP_LAT[n] : 0;
  };

  const rowCounts = (formation || '').split('-').map(Number).filter(n => n > 0);
  const rows: EspnRosterPlayer[][] = [players[0] ? [players[0]] : []];
  let i = 1;
  for (const count of rowCounts) {
    const slice = players.slice(i, i + count);
    slice.sort((a, b) => fpLat(a) - fpLat(b) || Number(a.formationPlace) - Number(b.formationPlace));
    rows.push(slice);
    i += count;
  }
  return rows;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test lib/formation.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/formation.ts lib/formation.test.ts
git commit -m "feat: port buildFormationRows from WC-2026-live-tracker (rows by line + lateral slot)"
```

---

### Task 24: `components/FormationPitch.tsx` — `useMemo`

**Files:**
- Create: `components/FormationPitch.tsx`
- Test: `components/FormationPitch.test.tsx`

**Interfaces:**
- Consumes: `buildFormationRows` (Task 23), `EspnRoster` (Task 4).
- Produces: `FormationPitch({ homeRoster, awayRoster })` — used by `app/match/[id]/page.tsx` (Task 27).

- [ ] **Step 1: Write the failing tests**

Create `components/FormationPitch.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as formationLib from '@/lib/formation';
import { FormationPitch } from './FormationPitch';
import type { EspnRoster } from '@/lib/types';

const roster: EspnRoster = {
  homeAway: 'home',
  team: { displayName: 'Manchester United' },
  formation: '4-3-3',
  roster: [{ starter: true, formationPlace: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Onana' } }],
};

describe('FormationPitch', () => {
  it('shows a fallback message when no lineup is available (e.g. a friendly)', () => {
    render(<FormationPitch />);
    expect(screen.getByText(/lineup not available/i)).toBeInTheDocument();
  });

  it('renders the home roster player', () => {
    render(<FormationPitch homeRoster={roster} />);
    expect(screen.getByText('Onana')).toBeInTheDocument();
  });

  it('memoizes buildFormationRows: re-rendering with the same roster reference does not recompute it', () => {
    const spy = vi.spyOn(formationLib, 'buildFormationRows');
    const { rerender } = render(<FormationPitch homeRoster={roster} />);
    const callsAfterFirstRender = spy.mock.calls.length;

    rerender(<FormationPitch homeRoster={roster} />); // same object reference
    expect(spy.mock.calls.length).toBe(callsAfterFirstRender);

    const changedRoster = { ...roster, formation: '4-4-2' };
    rerender(<FormationPitch homeRoster={changedRoster} />); // new reference
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirstRender);

    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/FormationPitch.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/FormationPitch.tsx
'use client';
import { useMemo } from 'react';
import { buildFormationRows } from '@/lib/formation';
import type { EspnRoster } from '@/lib/types';

export function FormationPitch({ homeRoster, awayRoster }: { homeRoster?: EspnRoster; awayRoster?: EspnRoster }) {
  // [React] buildFormationRows re-sorts and re-groups every starter on every call. It's
  // cheap for 11 players, but this page re-renders every 30s from usePolling while a
  // match is live — useMemo means it only re-runs when the roster/formation actually
  // change, not on every unrelated re-render (e.g. the live minute ticking elsewhere).
  const homeRows = useMemo(
    () => buildFormationRows(homeRoster?.roster, homeRoster?.formation),
    [homeRoster],
  );
  const awayRows = useMemo(
    () => buildFormationRows(awayRoster?.roster, awayRoster?.formation),
    [awayRoster],
  );

  if (!homeRoster && !awayRoster) {
    return <p>Lineup not available for this match.</p>;
  }

  return (
    <div data-testid="formation-pitch">
      <div data-testid="away-rows">
        {awayRows.map((row, i) => (
          <div key={i}>{row.map(p => p.athlete?.displayName).join(', ')}</div>
        ))}
      </div>
      <div data-testid="home-rows">
        {homeRows.map((row, i) => (
          <div key={i}>{row.map(p => p.athlete?.displayName).join(', ')}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test components/FormationPitch.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/FormationPitch.tsx components/FormationPitch.test.tsx
git commit -m "feat: add FormationPitch (useMemo over buildFormationRows, degrades with no lineup)"
```

---

### Task 25: `components/CupRun.tsx` — derived without memo

**Files:**
- Create: `components/CupRun.tsx`
- Test: `components/CupRun.test.tsx`

**Interfaces:**
- Consumes: `Match` (Task 4).
- Produces: `CupRun({ matches, competition })` — used by `app/standings/page.tsx` (Task 26).

- [ ] **Step 1: Write the failing tests**

Create `components/CupRun.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CupRun } from './CupRun';
import type { Match } from '@/lib/types';

function match(id: string, competition: Match['competition'], utcDate: string, opponent: string): Match {
  return {
    id, utcDate, status: 'SCHEDULED', competition,
    home: { name: 'Manchester United FC' }, away: { name: opponent }, venue: 'H',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('CupRun', () => {
  it('shows only matches for the requested competition, sorted by date', () => {
    render(<CupRun matches={[
      match('b', 'FA', '2027-01-10T15:00:00Z', 'Round 4 Opponent'),
      match('a', 'FA', '2026-12-01T15:00:00Z', 'Round 3 Opponent'),
      match('c', 'EFL', '2026-11-01T15:00:00Z', 'Not FA'),
    ]} competition="FA" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Round 3 Opponent');
    expect(items[1]).toHaveTextContent('Round 4 Opponent');
  });

  it('shows a placeholder when there are no fixtures yet', () => {
    render(<CupRun matches={[]} competition="EFL" />);
    expect(screen.getByText(/no fixtures yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test components/CupRun.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/CupRun.tsx
import type { Match } from '@/lib/types';

// [React] No useMemo here, unlike FormationPitch (Task 24): this filter+sort runs over a
// handful of cup fixtures, and its result isn't handed to an expensive child — the cost
// of recomputing on every render is negligible. Reach for useMemo when profiling shows a
// real cost, not by default; see FormationPitch for the contrasting case.
export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' }) {
  const rounds = matches
    .filter(m => m.competition === competition)
    .slice()
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (rounds.length === 0) {
    return <p>No fixtures yet this season.</p>;
  }

  return (
    <ol data-testid="cup-run">
      {rounds.map(m => (
        <li key={m.id}>
          {new Date(m.utcDate).toLocaleDateString('en-GB')} — vs {m.venue === 'H' ? m.away.name : m.home.name} ({m.venue}) —{' '}
          {m.score.display.home ?? '-'}:{m.score.display.away ?? '-'}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test components/CupRun.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/CupRun.tsx components/CupRun.test.tsx
git commit -m "feat: add CupRun (derived round list, deliberately without useMemo)"
```

---

## Milestone F — Remaining pages

### Task 26: `app/standings/page.tsx`

**Files:**
- Create: `app/standings/page.tsx`
- Test: `app/standings/page.test.tsx`

**Interfaces:**
- Consumes: `StandingRow`, `Match`, `MatchesResponse` (Task 4), `CupRun` (Task 25), `GET /api/matches` (Task 12), `GET /api/standings` (Task 13).
- Produces: the Standings page — EPL/UCL tables plus FA/EFL cup-run tabs, using **local** `useState` for the tab rather than the global `CompetitionFilterContext` (Task 22) — a deliberate contrast: that context exists because the *same* filter needs to be read in the layout nav and in the Schedule page; this tab is a concern private to this one page, so it doesn't need to escape the component.

- [ ] **Step 1: Write the failing tests**

Create `app/standings/page.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandingsPage from './page';

afterEach(() => vi.unstubAllGlobals());

describe('StandingsPage', () => {
  it('loads the PL table by default', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [{ position: 1, team: { name: 'AFC Bournemouth' }, playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalDifference: 0 }] }) });
      }
      return Promise.resolve({ json: async () => ({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } }) });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getByText('AFC Bournemouth')).toBeInTheDocument());
  });

  it('switches to a cup run when the FA tab is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: [] }) });
      return Promise.resolve({
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'fa1', utcDate: '2026-11-01T15:00:00Z', status: 'SCHEDULED', competition: 'FA',
            home: { name: 'Manchester United FC' }, away: { name: 'Some Opponent' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole('tab', { name: 'FA' }));
    await waitFor(() => expect(screen.getByText(/Some Opponent/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test app/standings/page.test.tsx`
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement**

Create `app/standings/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { Match, MatchesResponse, StandingRow } from '@/lib/types';
import { CupRun } from '@/components/CupRun';

type Tab = 'PL' | 'CL' | 'FA' | 'EFL';

export default function StandingsPage() {
  // [React] This tab lives only on this page. Reusing CompetitionFilterContext (Task 22)
  // here would couple two unrelated UI concerns for no benefit — local useState is the
  // right tool when a piece of state doesn't need to escape the component that owns it.
  const [tab, setTab] = useState<Tab>('PL');
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetch('/api/matches').then(res => res.json()).then((json: MatchesResponse) => setMatches(json.matches));
  }, []);

  useEffect(() => {
    if (tab !== 'PL' && tab !== 'CL') { setStandings(null); return; }
    let cancelled = false;
    setStandings(null);
    fetch(`/api/standings?comp=${tab}`)
      .then(res => res.json())
      .then((json: { standings: StandingRow[] }) => { if (!cancelled) setStandings(json.standings); });
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <main>
      <h1>Standings</h1>
      <div role="tablist">
        {(['PL', 'CL', 'FA', 'EFL'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {(tab === 'PL' || tab === 'CL') && (
        standings ? (
          <table>
            <tbody>
              {standings.map(row => (
                <tr key={row.team.name}>
                  <td>{row.position}</td>
                  <td>{row.team.name}</td>
                  <td>{row.playedGames}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Loading...</p>
      )}
      {(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}
    </main>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test app/standings/page.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/standings/page.tsx app/standings/page.test.tsx
git commit -m "feat: add Standings page (PL/CL tables + FA/EFL cup runs, local tab state)"
```

---

### Task 27: `app/match/[id]/page.tsx`

**Files:**
- Create: `app/match/[id]/page.tsx`
- Test: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `usePolling` (Task 19), `FormationPitch` (Task 24), `extractScorers` (Task 9), `EspnDetail` (Task 4).
- Produces: the match detail page — reads `espnId`/`slug` from the query string (set by `MatchCard`'s `Link` in Task 15), polls `/api/match/[id]` every 30s only while the match is live, renders lineups (degrading gracefully with no roster) and scorers.

- [ ] **Step 1: Write the failing tests**

Create `app/match/[id]/page.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

const mockParams = { id: '2026-08-22_hullcityafc' };
let mockSearchParams = new URLSearchParams({ espnId: '740966', slug: 'eng.1' });

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useSearchParams: () => mockSearchParams,
}));

import MatchDetailPage from './page';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); mockSearchParams = new URLSearchParams({ espnId: '740966', slug: 'eng.1' }); });

describe('MatchDetailPage', () => {
  it('shows an unavailable message when espnId/slug are missing (FD-only fixture)', () => {
    mockSearchParams = new URLSearchParams();
    render(<MatchDetailPage />);
    expect(screen.getByText(/detail unavailable/i)).toBeInTheDocument();
  });

  it('renders scorers and lineups once the detail loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [{ homeAway: 'home', team: { id: '331' } }, { homeAway: 'away', team: { id: '360' } }],
            details: [{ scoringPlay: true, clock: { displayValue: "33'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }] }],
          }],
        },
        rosters: [
          { homeAway: 'home', team: { displayName: 'Brighton' }, formation: '4-2-3-1', roster: [] },
          { homeAway: 'away', team: { displayName: 'Manchester United' }, formation: '4-2-3-1', roster: [] },
        ],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/Patrick Dorgu/)).toBeInTheDocument();
    expect(screen.getByTestId('formation-pitch')).toBeInTheDocument();
  });

  it('shows an error message when the detail fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<MatchDetailPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm test "app/match/[id]/page.test.tsx"`
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement**

Create `app/match/[id]/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePolling } from '@/hooks/usePolling';
import { FormationPitch } from '@/components/FormationPitch';
import { extractScorers } from '@/lib/merge';
import type { EspnDetail } from '@/lib/types';

async function fetchDetail(espnId: string, slug: string): Promise<EspnDetail> {
  const res = await fetch(`/api/match/${espnId}?slug=${slug}`);
  if (!res.ok) throw new Error('Failed to load match detail');
  return res.json();
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const espnId = searchParams.get('espnId');
  const slug = searchParams.get('slug');

  const [intervalMs, setIntervalMs] = useState<number | null>(null);
  const { data, error } = usePolling(
    () => (espnId && slug ? fetchDetail(espnId, slug) : Promise.reject(new Error('Match detail unavailable'))),
    intervalMs,
  );

  useEffect(() => {
    const state = data?.header?.competitions?.[0]?.status?.type?.state;
    setIntervalMs(state === 'in' ? 30_000 : null);
  }, [data]);

  if (!espnId || !slug) return <p>Match detail unavailable for this fixture.</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return <p>Loading...</p>;

  const headerComp = data.header?.competitions?.[0];
  const homeTeamEspnId = headerComp?.competitors?.find(c => c.homeAway === 'home')?.team?.id || '';
  const scorers = extractScorers(data, homeTeamEspnId);
  const rosters = data.rosters || [];
  const home = rosters.find(r => r.homeAway === 'home');
  const away = rosters.find(r => r.homeAway === 'away');

  return (
    <main>
      <h1>Match #{params.id}</h1>
      <FormationPitch homeRoster={home} awayRoster={away} />
      <section>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm test "app/match/[id]/page.test.tsx"`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Full-suite regression check and real-data smoke test**

Run: `npm test`
Expected: every suite from Task 2 through Task 27 passes.

Run: `npm run dev`, open `http://localhost:3000/schedule` in a browser (real `.env.local` key), wait for the PL fixtures to load, and confirm clicking a `FINISHED`/`IN_PLAY` card (once one exists in real data — none does yet in pre-season, so this check can be repeated once the season starts) navigates to `/match/[id]` and shows the page without crashing even with an empty roster. Stop the dev server after checking.

- [ ] **Step 6: Type-check and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add "app/match/[id]/page.tsx" "app/match/[id]/page.test.tsx"
git commit -m "feat: add match detail page (formation, scorers, live-only polling)"
```

---

### Task 28: `LEARNING.md`

**Files:**
- Create: `LEARNING.md`

**Interfaces:**
- Consumes: nothing (documentation only). References every `// [React]` comment added across Tasks 17–27.

- [ ] **Step 1: Write the file**

Create `LEARNING.md`:
```markdown
# LEARNING.md — React concepts this codebase teaches

A running notebook of the React mechanisms this project was built to make concrete.
Each entry points at the file/task where you can see it in real, working code — search
that file for `// [React]` comments for the inline explanation.

## 1. Props, lists, keys, conditional rendering (Milestone A)

- `components/MatchCard.tsx` (Task 15): a component that only reads props and returns
  different JSX based on `match.status` — no state at all. If you can't tell what a
  component renders without also knowing what happened to it before, it's not "just
  props" anymore.
- `components/MatchList.tsx` (Task 16): `.map()` over an array needs a `key` per item so
  React can match old DOM nodes to new ones across re-renders — using `match.id` (stable)
  instead of the array index (which shifts as the list is re-sorted/re-filtered) avoids
  React reusing the wrong DOM node for the wrong match.
- `app/page.tsx` (Task 17): the very first `useEffect` in this codebase, with the
  `cancelled` flag pattern — see section 3 below, it's introduced here in its simplest
  form before `usePolling` generalizes it.

## 2. State and lifting state up (Milestone B)

- `components/CompetitionFilterPills.tsx` (Task 18): a "controlled" component — it owns
  zero `useState`. Every bit of its behavior comes from `selected`/`onSelect` props.
- `app/schedule/page.tsx` (Task 18, before Task 22): the filter state lives on the page
  because the page is the nearest common parent of the two components that need it (the
  pills and the list). This is "lifting state up": move state to the lowest common
  ancestor of everyone who needs it, no higher.

## 3. `useEffect`, cleanup, refs (Milestone C — `usePolling`)

`hooks/usePolling.ts` (Task 19) is the deepest lesson in this codebase:

- **The effect body runs after render**, not during it — `setInterval` inside `useEffect`
  is how you synchronize a component with something outside React (a timer, in this
  case).
- **The cleanup function** (the function an effect returns) runs before the *next* effect
  and on unmount. Here it does two things: `clearInterval(id)` stops the timer, and
  setting `cancelled = true` stops a fetch that was already in flight from calling
  `setState` after this run is no longer current.
- **The ref (`fetcherRef`)** exists because the dependency array `[intervalMs]`
  deliberately does *not* include `fetcher` — an inline arrow function has a new identity
  every render, so putting it in the dependency array would tear down and rebuild the
  interval on every render, not just when `intervalMs` changes. The ref lets the effect
  always call the *latest* fetcher without needing to restart because of it.
- **Effect chaining**: `app/page.tsx` (Task 21) computes `intervalMs` from `data` — which
  is itself set *by* `usePolling` — in a second `useEffect`. A state update triggering
  another effect that triggers another state update is normal React, and easy to miss the
  first time you see it.

## 4. Context (Milestone D)

`contexts/CompetitionFilterContext.tsx` (Task 22): the trigger for reaching past "lift
state up" wasn't "this state feels important" — it was that the two components that
needed it (`NavFilterPills` in `app/layout.tsx`, and `app/schedule/page.tsx`) aren't in a
parent/child relationship. A Next.js layout renders a page through `{children}`; it has no
way to hand that page extra props. Context is what fills that specific gap. Compare this
to Task 18's local lifted state, which was enough until the same filter needed to live in
the shared layout too.

## 5. Derived state and `useMemo` (Milestone E)

- `components/FormationPitch.tsx` (Task 24): `buildFormationRows` is wrapped in
  `useMemo(() => ..., [homeRoster])` because this page re-renders every 30 seconds from
  `usePolling` while a match is live, and recomputing the row layout on every one of those
  ticks (when the roster hasn't changed) would be wasted work.
- `components/CupRun.tsx` (Task 25): the deliberate contrast — no `useMemo` here, because
  filtering/sorting a handful of cup fixtures is cheap and nothing expensive consumes the
  result. `useMemo` is a fix for a measured cost, not a default.
```

- [ ] **Step 2: Commit**

```bash
git add LEARNING.md
git commit -m "docs: add LEARNING.md (React concept notebook indexed by milestone)"
```

---

## Self-review

**Spec coverage** (against `docs/superpowers/specs/2026-07-16-mu-live-tracker-design.md`):
- Section 2 (season/competition detection): Task 8 (`currentSeasonLabel`), Task 12 (`/api/matches` calling FD with no `season` param + all 5 ESPN slugs).
- Section 3 (architecture, BFF, cache, endpoints): Tasks 7, 12, 13, 14.
- Section 4 (domain model, competition mapping, merge algorithm, formation): Tasks 4, 5, 6, 9, 23.
- Section 5 (bug-lesson coverage — NFD normalization, pre-shootout score, formation `-L/-R`, clickable-status rule): Task 6 (normalize test), Task 9 (`computeDisplayScore` shootout test), Task 23 (formation `-L/-R` test), Task 15 (clickable-status tests).
- Section 6 (learning-first: milestones by concept, `LEARNING.md`, `// [React]` comments): the whole plan is organized as Milestones A–E in React-concept order; Task 28 is the `LEARNING.md` deliverable.
- Section 7 (MU identity: red/black/gold theme, Fergie Time, MU-perspective venue): Task 3 (theme tokens), Task 20 (`isFergieTime`/`LiveBadge`), Task 15/25 (`vs {opponent} ({venue})` framing throughout).
- Section 8 (error handling/degradation): Task 12 (`Promise.allSettled`, `meta.sources`), Task 21 (stale-data + partial-source banners), Task 24 (`FormationPitch` no-lineup fallback).
- Section 9 (testing): every `lib/` task has a colocated `*.test.ts`; every component/page/hook has RTL tests; Task 12/13/14 are verified against the real APIs in a manual smoke-test step in addition to mocked unit tests.
- Section 10 (out of scope): deploy, Server Components, distributed cache, and the WC-2026 tournament files (`elimination.js`/`bracket.js`/`campaign.js`) are correctly never referenced anywhere in this plan.

**Placeholder scan:** no `TBD`/`TODO`-as-a-blocker, no "add appropriate error handling," no "similar to Task N" without the code repeated. The one intentional stub (`isFergieTime` inline in Task 15, replaced in Task 20) is explicitly called out as temporary with the exact task that removes it.

**Type consistency:** `Match`, `MatchesResponse`, `CompetitionId`, `StandingRow`, `FdMatch`, `EspnScheduleEvent`, `EspnDetail`, `Scorers`, `EspnRoster`, `EspnRosterPlayer` are defined exactly once (Task 4) and every later task imports rather than redeclares them. `FilterValue` is defined once (Task 18) and imported by Task 22. `pollingIntervalForMatches`/`LIVE_POLL_MS`/`NEAR_KICKOFF_POLL_MS` (Task 19) are the single source of truth for polling cadence, used identically in Task 21 and referenced conceptually (own 30s constant) in Task 27.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-07-16-mu-live-tracker-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

