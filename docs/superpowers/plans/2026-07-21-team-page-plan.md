# Team Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Team" nav tab showing MU's current first-team squad, grouped by position (Goalkeepers/Defenders/Midfielders/Forwards), each player rendered as a retro-1999-style jersey icon + squad number + name — no player photos.

**Architecture:** football-data.org's `/teams/66` squad endpoint is the source of truth for *who's on the squad* and their position group (it's accurate but has no jersey-number field); ESPN's `/teams/360/roster` endpoint supplies jersey numbers only, matched to football-data players by normalized (diacritic-stripped) name. A pure `buildSquad()` function in `lib/team.ts` does the merge/group/sort; a cached API route serves the result; a client page renders it with a new `JerseyIcon` component.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + Testing Library.

## Global Constraints

- No player photos anywhere — jersey icon + name + squad number only (spec: "Goal").
- Group order is fixed: Goalkeepers, Defenders, Midfielders, Forwards (spec: "Visual design").
- Within a group, sort by jersey number ascending; players with no matched jersey number sort last, by name (spec: "Architecture").
- A football-data squad player with no ESPN jersey match must still render (with `–` in place of a number) — never dropped from the list (spec: "Data sources & merge strategy").
- No club crest/logo graphic — avoid reproducing the trademarked crest (spec: "Visual design").
- Team API route caches with `STATIC_TTL_MS` (`lib/cache.ts`), the same tier already used for standings (spec: "Architecture").
- Reuse `lib/normalize.ts`'s existing `normalizeTeamName` for the diacritic-stripped name match — it already does exactly this (lowercase, NFD-strip accents, strip non-alphanumeric) and is proven against these exact players (Bayındır/Bayindir, Šeško/Sesko) in this plan's own research; do not write a second, near-duplicate normalizer.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/types.ts` (modify) | Add `FdSquadPlayer`, `EspnTeamAthlete`, `EspnTeamRoster` wire types |
| `lib/fd.ts` (modify) | Add `fetchSquad(apiKey)` — football-data `/teams/66` |
| `lib/fd.test.ts` (modify) | Test for `fetchSquad` |
| `lib/espn.ts` (modify) | Add `fetchEspnRoster()` — ESPN `/teams/360/roster` |
| `lib/espn.test.ts` (modify) | Test for `fetchEspnRoster` |
| `lib/team.ts` (create) | Pure `buildSquad(fdSquad, espnRoster)` — merge, group, sort |
| `lib/team.test.ts` (create) | Unit tests for `buildSquad` |
| `app/api/team/route.ts` (create) | GET route: fetch both sources, cache, respond |
| `app/api/team/route.test.ts` (create) | Route test: merge + cache behavior |
| `components/JerseyIcon.tsx` (create) | Renders one player's jersey SVG + squad number |
| `components/JerseyIcon.module.css` (create) | Jersey icon styles |
| `components/JerseyIcon.test.tsx` (create) | Component test |
| `app/team/page.tsx` (create) | Client page: fetch, group headings, player grid |
| `app/team/page.module.css` (create) | Page layout/typography styles |
| `app/team/page.test.tsx` (create) | Page test: renders groups, counts, jersey+name |
| `app/layout.tsx` (modify) | Add "Team" nav link |

---

## Task 1: `fetchSquad` — football-data squad endpoint

**Files:**
- Modify: `lib/types.ts` (add `FdSquadPlayer`)
- Modify: `lib/fd.ts` (add `fetchSquad`)
- Modify: `lib/fd.test.ts` (add tests)

**Interfaces:**
- Produces: `FdSquadPlayer = { name: string; position: string; dateOfBirth: string; nationality: string }` (exported from `lib/types.ts`); `fetchSquad(apiKey: string): Promise<FdSquadPlayer[]>` (exported from `lib/fd.ts`), reuses existing `fdFetch`/`FdApiError` from the same file.

- [ ] **Step 1: Add the `FdSquadPlayer` type**

In `lib/types.ts`, add after the existing `FdStandingRow` interface (around line 121):

```typescript
export interface FdSquadPlayer {
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
}
```

- [ ] **Step 2: Write the failing test**

In `lib/fd.test.ts`, add a new `describe` block after the closing of `describe('fetchStandings', ...)`:

```typescript
describe('fetchSquad', () => {
  it('sends the API key as X-Auth-Token and hits /teams/66, returning the squad array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ squad: [{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSquad('secret-key');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.football-data.org/v4/teams/${MU_FD_ID}`,
      { headers: { 'X-Auth-Token': 'secret-key' } },
    );
    expect(result).toEqual([{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }]);
  });

  it('returns an empty array when the response has no squad field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    expect(await fetchSquad('k')).toEqual([]);
  });
});
```

Also update the import line at the top of `lib/fd.test.ts` from:
```typescript
import { fetchMuMatches, fetchStandings, FdApiError } from './fd';
```
to:
```typescript
import { fetchMuMatches, fetchStandings, fetchSquad, FdApiError } from './fd';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/fd.test.ts`
Expected: FAIL — `fetchSquad is not a function` (or similar import error).

- [ ] **Step 4: Implement `fetchSquad`**

In `lib/fd.ts`, add the import and function:

```typescript
import type { FdMatch, FdStandingRow, FdSquadPlayer } from './types';
```
(replace the existing `import type { FdMatch, FdStandingRow } from './types';` line at the top)

Then add, after `fetchStandings`:

```typescript
export async function fetchSquad(apiKey: string): Promise<FdSquadPlayer[]> {
  const data = (await fdFetch(`/teams/${MU_FD_ID}`, apiKey)) as { squad?: FdSquadPlayer[] };
  return data.squad || [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/fd.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/fd.ts lib/fd.test.ts
git commit -m "feat: add fetchSquad for football-data's team squad endpoint"
```

---

## Task 2: `fetchEspnRoster` — ESPN team roster endpoint

**Files:**
- Modify: `lib/types.ts` (add `EspnTeamAthlete`, `EspnTeamRoster`)
- Modify: `lib/espn.ts` (add `fetchEspnRoster`)
- Modify: `lib/espn.test.ts` (add tests)

**Interfaces:**
- Produces: `EspnTeamAthlete = { displayName: string; jersey?: string; position?: { displayName?: string } }`, `EspnTeamRoster = { athletes: EspnTeamAthlete[] }` (exported from `lib/types.ts`); `fetchEspnRoster(): Promise<EspnTeamRoster>` (exported from `lib/espn.ts`, no params — this app only ever needs MU's own roster, so the league slug/team id are hardcoded rather than exposed as unused configurability).

- [ ] **Step 1: Add the ESPN team-roster types**

In `lib/types.ts`, add after `EspnRoster` (around line 166):

```typescript
export interface EspnTeamAthlete {
  displayName: string;
  jersey?: string;
  position?: { displayName?: string };
}

export interface EspnTeamRoster {
  athletes: EspnTeamAthlete[];
}
```

- [ ] **Step 2: Write the failing test**

In `lib/espn.test.ts`, add at the end of the file:

```typescript
describe('fetchEspnRoster', () => {
  it('hits the team roster endpoint for MU in the Premier League', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ athletes: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEspnRoster();

    expect(fetchMock).toHaveBeenCalledWith(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/${MU_ESPN_ID}/roster`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
  });

  it('returns the athletes array from the response', async () => {
    const athletes = [{ displayName: 'Bruno Fernandes', jersey: '8', position: { displayName: 'Midfielder' } }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ athletes }) }));
    expect(await fetchEspnRoster()).toEqual({ athletes });
  });
});
```

Update the import line at the top of `lib/espn.test.ts` from:
```typescript
import { fetchEspnSchedule, fetchEspnDetail } from './espn';
```
to:
```typescript
import { fetchEspnSchedule, fetchEspnDetail, fetchEspnRoster } from './espn';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/espn.test.ts`
Expected: FAIL — `fetchEspnRoster is not a function`.

- [ ] **Step 4: Implement `fetchEspnRoster`**

In `lib/espn.ts`, update the type import at the top from:
```typescript
import type { EspnDetail, EspnScheduleEvent } from './types';
```
to:
```typescript
import type { EspnDetail, EspnScheduleEvent, EspnTeamRoster } from './types';
```

Then add, after `fetchEspnDetail`:

```typescript
export async function fetchEspnRoster(): Promise<EspnTeamRoster> {
  return (await espnFetch(`/eng.1/teams/${MU_ESPN_ID}/roster`)) as EspnTeamRoster;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/espn.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/espn.ts lib/espn.test.ts
git commit -m "feat: add fetchEspnRoster for MU's ESPN team roster (jersey numbers)"
```

---

## Task 3: `buildSquad` — merge, group, sort

**Files:**
- Create: `lib/team.ts`
- Create: `lib/team.test.ts`

**Interfaces:**
- Consumes: `FdSquadPlayer`, `EspnTeamRoster` (from `lib/types.ts`, Tasks 1–2); `normalizeTeamName` from `lib/normalize.ts`.
- Produces: `PositionGroupLabel = 'Goalkeepers' | 'Defenders' | 'Midfielders' | 'Forwards'`, `TeamPlayer = { name: string; jersey: number | null }`, `TeamGroup = { label: PositionGroupLabel; players: TeamPlayer[] }`, `buildSquad(fdSquad: FdSquadPlayer[], espnRoster: EspnTeamRoster): TeamGroup[]` — all exported from `lib/team.ts`. Task 4 imports `TeamGroup` and `buildSquad` from here.

- [ ] **Step 1: Write the failing tests**

Create `lib/team.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSquad } from './team';
import type { FdSquadPlayer, EspnTeamRoster } from './types';

function fdPlayer(overrides: Partial<FdSquadPlayer> = {}): FdSquadPlayer {
  return { name: 'Test Player', position: 'Midfield', dateOfBirth: '2000-01-01', nationality: 'England', ...overrides };
}

describe('buildSquad', () => {
  it('always returns exactly the four groups, in Goalkeepers/Defenders/Midfielders/Forwards order', () => {
    const groups = buildSquad([], { athletes: [] });
    expect(groups.map(g => g.label)).toEqual(['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']);
  });

  it('maps football-data position strings to the matching display group', () => {
    const fdSquad = [
      fdPlayer({ name: 'A', position: 'Goalkeeper' }),
      fdPlayer({ name: 'B', position: 'Defence' }),
      fdPlayer({ name: 'C', position: 'Midfield' }),
      fdPlayer({ name: 'D', position: 'Offence' }),
    ];
    const groups = buildSquad(fdSquad, { athletes: [] });
    expect(groups.find(g => g.label === 'Goalkeepers')!.players.map(p => p.name)).toEqual(['A']);
    expect(groups.find(g => g.label === 'Defenders')!.players.map(p => p.name)).toEqual(['B']);
    expect(groups.find(g => g.label === 'Midfielders')!.players.map(p => p.name)).toEqual(['C']);
    expect(groups.find(g => g.label === 'Forwards')!.players.map(p => p.name)).toEqual(['D']);
  });

  it('matches jersey numbers from the ESPN roster by normalized (diacritic-stripped) name', () => {
    const fdSquad = [fdPlayer({ name: 'Altay Bayındır', position: 'Goalkeeper' })];
    const espnRoster: EspnTeamRoster = { athletes: [{ displayName: 'Altay Bayindir', jersey: '1' }] };
    const groups = buildSquad(fdSquad, espnRoster);
    expect(groups.find(g => g.label === 'Goalkeepers')!.players).toEqual([{ name: 'Altay Bayındır', jersey: 1 }]);
  });

  it('keeps a football-data player with no ESPN match, with jersey: null instead of dropping them', () => {
    const fdSquad = [fdPlayer({ name: 'Andrey Santos', position: 'Midfield' })];
    const groups = buildSquad(fdSquad, { athletes: [] });
    expect(groups.find(g => g.label === 'Midfielders')!.players).toEqual([{ name: 'Andrey Santos', jersey: null }]);
  });

  it('sorts each group by jersey number ascending, with unnumbered players last by name', () => {
    const fdSquad = [
      fdPlayer({ name: 'Zed Unnumbered', position: 'Defence' }),
      fdPlayer({ name: 'High Number', position: 'Defence' }),
      fdPlayer({ name: 'Low Number', position: 'Defence' }),
      fdPlayer({ name: 'Amy Unnumbered', position: 'Defence' }),
    ];
    const espnRoster: EspnTeamRoster = {
      athletes: [
        { displayName: 'High Number', jersey: '30' },
        { displayName: 'Low Number', jersey: '2' },
      ],
    };
    const groups = buildSquad(fdSquad, espnRoster);
    expect(groups.find(g => g.label === 'Defenders')!.players.map(p => p.name)).toEqual([
      'Low Number', 'High Number', 'Amy Unnumbered', 'Zed Unnumbered',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/team.test.ts`
Expected: FAIL — cannot find module `./team`.

- [ ] **Step 3: Implement `buildSquad`**

Create `lib/team.ts`:

```typescript
import type { FdSquadPlayer, EspnTeamRoster } from './types';
import { normalizeTeamName } from './normalize';

export type PositionGroupLabel = 'Goalkeepers' | 'Defenders' | 'Midfielders' | 'Forwards';

export interface TeamPlayer {
  name: string;
  jersey: number | null;
}

export interface TeamGroup {
  label: PositionGroupLabel;
  players: TeamPlayer[];
}

const GROUP_ORDER: PositionGroupLabel[] = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'];

// football-data.org's /teams/{id} squad uses exactly these four position strings —
// verified live 2026-07-21 against MU's own squad. 'Offence' is the only value that
// isn't Goalkeeper/Defence/Midfield, so it's the default case rather than an explicit one.
function groupForFdPosition(position: string): PositionGroupLabel {
  switch (position) {
    case 'Goalkeeper': return 'Goalkeepers';
    case 'Defence': return 'Defenders';
    case 'Midfield': return 'Midfielders';
    default: return 'Forwards';
  }
}

// ESPN's roster is missing some current signings entirely and uses different
// diacritics than football-data (e.g. "Bayindir" vs "Bayındır") — normalizeTeamName's
// existing lowercase+NFD-strip+alphanumeric-only behavior (built for team-name
// matching) works identically well here, so it's reused rather than duplicated.
function jerseyByNormalizedName(roster: EspnTeamRoster): Map<string, number> {
  const map = new Map<string, number>();
  for (const athlete of roster.athletes) {
    const jersey = Number(athlete.jersey);
    if (!athlete.jersey || Number.isNaN(jersey)) continue;
    map.set(normalizeTeamName(athlete.displayName), jersey);
  }
  return map;
}

export function buildSquad(fdSquad: FdSquadPlayer[], espnRoster: EspnTeamRoster): TeamGroup[] {
  const jerseyByName = jerseyByNormalizedName(espnRoster);
  const groups = new Map<PositionGroupLabel, TeamPlayer[]>(GROUP_ORDER.map(label => [label, []]));

  for (const p of fdSquad) {
    const label = groupForFdPosition(p.position);
    const jersey = jerseyByName.get(normalizeTeamName(p.name)) ?? null;
    groups.get(label)!.push({ name: p.name, jersey });
  }

  for (const players of groups.values()) {
    players.sort((a, b) => {
      if (a.jersey === null && b.jersey === null) return a.name.localeCompare(b.name);
      if (a.jersey === null) return 1;
      if (b.jersey === null) return -1;
      return a.jersey - b.jersey;
    });
  }

  return GROUP_ORDER.map(label => ({ label, players: groups.get(label)! }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/team.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/team.ts lib/team.test.ts
git commit -m "feat: add buildSquad to merge football-data squad with ESPN jersey numbers"
```

---

## Task 4: `GET /api/team` route

**Files:**
- Create: `app/api/team/route.ts`
- Create: `app/api/team/route.test.ts`

**Interfaces:**
- Consumes: `fetchSquad` (`lib/fd.ts`, Task 1), `fetchEspnRoster` (`lib/espn.ts`, Task 2), `buildSquad`/`TeamGroup` (`lib/team.ts`, Task 3), `getCached`/`setCached`/`STATIC_TTL_MS` (`lib/cache.ts`).
- Produces: `GET(): Promise<NextResponse>` returning JSON `{ groups: TeamGroup[] }`. Task 6 (the page) fetches this route and expects that exact shape.

- [ ] **Step 1: Write the failing tests**

Create `app/api/team/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchSquad: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnRoster: vi.fn() }));

import { fetchSquad } from '@/lib/fd';
import { fetchEspnRoster } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchSquad = vi.mocked(fetchSquad);
const mockFetchEspnRoster = vi.mocked(fetchEspnRoster);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/team', () => {
  it('merges football-data squad with ESPN jersey numbers into grouped players', async () => {
    mockFetchSquad.mockResolvedValue([{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }]);
    mockFetchEspnRoster.mockResolvedValue({ athletes: [{ displayName: 'Bruno Fernandes', jersey: '8' }] });

    const res = await GET();
    const body = await res.json();

    expect(body.groups.find((g: { label: string }) => g.label === 'Midfielders').players).toEqual([
      { name: 'Bruno Fernandes', jersey: 8 },
    ]);
  });

  it('serves the second call from cache without calling fetchSquad again', async () => {
    mockFetchSquad.mockResolvedValue([]);
    mockFetchEspnRoster.mockResolvedValue({ athletes: [] });

    await GET();
    await GET();

    expect(mockFetchSquad).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/team/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Implement the route**

Create `app/api/team/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { fetchSquad } from '@/lib/fd';
import { fetchEspnRoster } from '@/lib/espn';
import { buildSquad } from '@/lib/team';
import { getCached, setCached, STATIC_TTL_MS } from '@/lib/cache';
import type { TeamGroup } from '@/lib/team';

const CACHE_KEY = 'team';

export async function GET() {
  const cached = getCached<TeamGroup[]>(CACHE_KEY);
  if (cached) return NextResponse.json({ groups: cached });

  const apiKey = process.env.FOOTBALL_API_KEY || '';
  const [fdSquad, espnRoster] = await Promise.all([
    fetchSquad(apiKey),
    fetchEspnRoster(),
  ]);

  const groups = buildSquad(fdSquad, espnRoster);
  setCached(CACHE_KEY, groups, STATIC_TTL_MS);
  return NextResponse.json({ groups });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/team/route.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/team/route.ts app/api/team/route.test.ts
git commit -m "feat: add GET /api/team route serving the merged, cached squad"
```

---

## Task 5: `JerseyIcon` component

**Files:**
- Create: `components/JerseyIcon.tsx`
- Create: `components/JerseyIcon.module.css`
- Create: `components/JerseyIcon.test.tsx`

**Interfaces:**
- Produces: `JerseyIcon({ jersey }: { jersey: number | null })` — default export is a named export `JerseyIcon`, exported from `components/JerseyIcon.tsx`. Task 6 (the page) imports this and passes each player's `jersey: number | null` from `TeamPlayer` (Task 3).

- [ ] **Step 1: Write the failing tests**

Create `components/JerseyIcon.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JerseyIcon } from './JerseyIcon';

describe('JerseyIcon', () => {
  it('shows the squad number when present', () => {
    render(<JerseyIcon jersey={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows a dash placeholder when jersey is null', () => {
    render(<JerseyIcon jersey={null} />);
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/JerseyIcon.test.tsx`
Expected: FAIL — cannot find module `./JerseyIcon`.

- [ ] **Step 3: Implement `JerseyIcon`**

Create `components/JerseyIcon.module.css`:

```css
.wrap {
  position: relative;
  width: 64px;
}

.shirt {
  width: 100%;
  height: auto;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
}

.number {
  position: absolute;
  top: 56%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 17px;
  color: var(--mu-white);
}

.noNumber {
  font-size: 15px;
  color: rgba(237, 230, 214, 0.55);
}

@media (max-width: 460px) {
  .wrap { width: 54px; }
}
```

Create `components/JerseyIcon.tsx`:

```typescript
import styles from './JerseyIcon.module.css';

// A flat-illustration jersey evoking the 1998-99 Umbro home kit (the Treble-winning
// shirt): set-in sleeves, a white V-neck collar with black piping, white cuffs with
// black piping, and a diagonal white shoulder-seam piping line. No club crest — that's
// a trademarked graphic this component deliberately doesn't reproduce. The body outline
// uses --mu-white (not a darker red) so it reads clearly against the red fill, and the
// silhouette is a single polygon with no concave notch at the underarm — an earlier
// version had a gap there that exposed the page background as an unwanted dark wedge.
export function JerseyIcon({ jersey }: { jersey: number | null }) {
  return (
    <div className={styles.wrap}>
      <svg className={styles.shirt} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M29,19 L14,26 L9,40 L21,46 L29,46 L29,92 L71,92 L71,46 L79,46 L91,40 L86,26 L71,19 Z"
          fill="#DA291C" stroke="#EDE6D6" strokeWidth="1.6" strokeLinejoin="round"
        />
        <path d="M29,19 L21,46" stroke="#EDE6D6" strokeWidth="1.1" opacity="0.9" />
        <path d="M71,19 L79,46" stroke="#EDE6D6" strokeWidth="1.1" opacity="0.9" />
        <path
          d="M36,17 L45,22 L50,29 L55,22 L64,17 L64,21 L56,29 L50,36 L44,29 L36,21 Z"
          fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1.3" strokeLinejoin="round"
        />
        <path d="M9,40 L21,46 L19.5,49.5 L7.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1" />
        <path d="M91,40 L79,46 L80.5,49.5 L92.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1" />
      </svg>
      <span className={jersey === null ? `${styles.number} ${styles.noNumber}` : styles.number}>
        {jersey === null ? '–' : jersey}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/JerseyIcon.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add components/JerseyIcon.tsx components/JerseyIcon.module.css components/JerseyIcon.test.tsx
git commit -m "feat: add JerseyIcon component (retro 1999 kit, no player photos)"
```

---

## Task 6: Team page + nav link

**Files:**
- Create: `app/team/page.tsx`
- Create: `app/team/page.module.css`
- Create: `app/team/page.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `TeamGroup` (`lib/team.ts`, Task 3), `JerseyIcon` (`components/JerseyIcon.tsx`, Task 5), `PageHeading` (`components/PageHeading.tsx`), `LoadingSpinner` (`components/LoadingSpinner.tsx`), `usePolling` (`hooks/usePolling.ts`), `STATIC_TTL_MS` (`lib/cache.ts`). Fetches `GET /api/team` (Task 4), expecting `{ groups: TeamGroup[] }`.

- [ ] **Step 1: Write the failing tests**

Create `app/team/page.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeamPage from './page';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockTeamResponse(groups: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ groups }),
  }));
}

describe('TeamPage', () => {
  it('renders all four position group headings with player counts', async () => {
    mockTeamResponse([
      { label: 'Goalkeepers', players: [{ name: 'Altay Bayindir', jersey: 1 }] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByTestId('group-Goalkeepers')).toBeInTheDocument());
    expect(screen.getByTestId('group-Goalkeepers')).toHaveTextContent('Goalkeepers 1');
    expect(screen.getByTestId('group-Defenders')).toHaveTextContent('Defenders 0');
    expect(screen.getByTestId('group-Midfielders')).toHaveTextContent('Midfielders 0');
    expect(screen.getByTestId('group-Forwards')).toHaveTextContent('Forwards 0');
  });

  it('renders a jersey number and the player name for a numbered player', async () => {
    // jersey: 7 is deliberately distinct from every group's player count (which would
    // otherwise render as its own "0"/"1" text node and collide with getByText below).
    mockTeamResponse([
      { label: 'Goalkeepers', players: [{ name: 'Altay Bayindir', jersey: 7 }] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByText('Bayindir')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Altay')).toBeInTheDocument();
  });

  it('renders a dash placeholder for a player with no jersey number', async () => {
    mockTeamResponse([
      { label: 'Goalkeepers', players: [] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [{ name: 'Andrey Santos', jersey: null }] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByText('Santos')).toBeInTheDocument());
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/team/page.test.tsx`
Expected: FAIL — cannot find module `./page`.

- [ ] **Step 3: Implement the page styles**

Create `app/team/page.module.css`:

```css
.main {
  max-width: 880px;
  margin: 0 auto;
  padding: 20px 18px 60px;
}

.subtitle {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--mu-white);
  opacity: 0.55;
  margin: 0 0 30px;
}

.group {
  margin-bottom: 34px;
}

.groupLabel {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mu-white);
  opacity: 0.6;
  margin-bottom: 14px;
}

.groupLabel::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(237, 230, 214, 0.35), transparent);
}

.groupCount {
  color: var(--mu-white);
  opacity: 0.4;
  font-weight: 400;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 14px 10px;
}

.player {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.name {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.given {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mu-gold);
}

.surname {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--mu-gold);
  margin-top: 1px;
}

@media (max-width: 460px) {
  .grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); }
  .surname { font-size: 12.5px; }
  .given { font-size: 8px; }
}
```

- [ ] **Step 4: Implement the page**

Create `app/team/page.tsx`:

```typescript
'use client';
import type { TeamGroup } from '@/lib/team';
import { PageHeading } from '@/components/PageHeading';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { JerseyIcon } from '@/components/JerseyIcon';
import { usePolling } from '@/hooks/usePolling';
import { STATIC_TTL_MS } from '@/lib/cache';
import styles from './page.module.css';

async function fetchTeam(): Promise<{ groups: TeamGroup[] }> {
  const res = await fetch('/api/team');
  if (!res.ok) throw new Error('Failed to load team');
  return res.json();
}

export default function TeamPage() {
  const { data, loading, refetch, lastSyncedAt, error } = usePolling(fetchTeam, null, { key: 'team', ttlMs: STATIC_TTL_MS });
  const groups = data?.groups ?? [];

  return (
    <main className={styles.main}>
      <PageHeading
        title="Team"
        onRefresh={refetch}
        refreshing={loading}
        lastSyncedAt={lastSyncedAt}
        error={error}
      />
      <p className={styles.subtitle}>Current first-team squad, by position</p>

      {groups.length === 0 ? (
        <LoadingSpinner />
      ) : (
        groups.map(group => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupLabel} data-testid={`group-${group.label}`}>
              {group.label} <span className={styles.groupCount}>{group.players.length}</span>
            </div>
            <div className={styles.grid}>
              {group.players.map(player => {
                const [given, ...rest] = player.name.split(' ');
                const surname = rest.join(' ') || given;
                return (
                  <div key={player.name} className={styles.player}>
                    <JerseyIcon jersey={player.jersey} />
                    <span className={styles.name}>
                      <span className={styles.given}>{given}</span>
                      <span className={styles.surname}>{surname}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
```

- [ ] **Step 5: Add the nav link**

In `app/layout.tsx`, change:

```typescript
            <Link href="/stats">Stats</Link>
```

to:

```typescript
            <Link href="/stats">Stats</Link>
            <Link href="/team">Team</Link>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run app/team/page.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: All tests pass; no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/team/page.tsx app/team/page.module.css app/team/page.test.tsx app/layout.tsx
git commit -m "feat: add Team page grouped by position, with nav link"
```

---

## Self-Review Notes

- **Spec coverage:** merge strategy (Task 3), fixed group order (Task 3 + test), jersey-ascending/unnumbered-last sort (Task 3 + test), `–` fallback instead of dropping players (Task 3 + Task 5), retro-1999 jersey with no crest (Task 5), no player photos anywhere (Task 5/6), `STATIC_TTL_MS` caching (Task 4), nav link (Task 6), given/surname two-line gold typography (Task 6) — all covered.
- **Type consistency:** `TeamGroup`/`TeamPlayer`/`PositionGroupLabel` (Task 3) are the exact names/shapes consumed by Task 4's route and Task 6's page; `jersey: number | null` is threaded consistently from `buildSquad` through the API response through `JerseyIcon`'s prop.
- **Out of scope carried over from spec:** no season picker, no further reconciliation of ESPN's stale roster beyond name-matching.
