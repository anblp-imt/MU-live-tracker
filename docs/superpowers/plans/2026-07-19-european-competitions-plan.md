# Dynamic European Competition Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MU plays in at most one of UEFA's three club competitions (Champions League, Europa League, Conference League) per season, or none — never more than one, and it's not the same one every year. Today the app hardcodes exactly one European slot (`CL` → `uefa.champions`), so a season where MU is in the Europa League instead would silently fetch the wrong ESPN slug and lose all European fixtures entirely, not just show an empty tab. This plan adds the two missing competitions (`EL`, `ECL`) and makes their tabs appear only when MU actually has a match in them that season — while leaving PL/FA/EFL's existing always-shown tab behavior untouched, since that wasn't asked for and isn't broken.

**Architecture:** `lib/competitions.ts`'s `COMPETITIONS` array already drives every page's tab list and every API route's ESPN-slug fan-out generically — adding two entries there is enough for the *data* layer (fetching) to pick up whichever European competition MU is actually in, with zero other code changes (the existing `Promise.allSettled` fan-out in `/api/matches` and `/api/leaders` already tolerates a competition returning zero matches). The *display* layer needs one new pure helper, `visibleCompetitions()`, that filters the tab list down to "at most one of CL/EL/ECL, and only if it has a match" while leaving every non-European entry untouched — reused identically by the three pages that render competition tabs (Schedule at `app/page.tsx`, Stats, Standings).

**Tech Stack:** TypeScript, React (Next.js App Router), Vitest — no new dependencies.

## Global Constraints

- No new npm dependencies.
- `EL`/`ECL` follow the **FA Cup/Carabao Cup pattern** (ESPN-only, `hasStandings: false`, rendered via the existing `CupRun` "hành trình vòng đấu" component) — **not** the Champions League pattern. football-data.org's free tier does not cover Europa League or Conference League standings (documented in this repo's `HANDOFF.md` line 33: only `GET /v4/competitions/PL/standings` and `.../CL/standings` are free) — `fdCode` must be left `undefined` for both, exactly like `FA`/`EFL` already are.
- The "only show if MU has a match there" rule applies **only** to `CL`/`EL`/`ECL` (the mutually-exclusive European slot). `PL`, `FA`, `EFL` keep their current always-shown behavior on every page — do not change their visibility logic.
- `FRIENDLY` is never a tab on Standings (already true today) and is excluded from Stats' tabs (already true, a prior fix) — preserve both exactly. Schedule currently *does* show a Friendly tab unconditionally — preserve that too (out of scope to change).
- A real UEFA league-phase standings table for EL/ECL (like CL already has) is explicitly **out of scope** for this plan — ESPN may have the data but wiring a second standings source is a separate, larger effort. Note it as a known limitation, don't build it.
- Run `npm test` and `npm run typecheck` after every task; run `npm run build` after the final task.
- Every commit message follows this repo's existing style (`feat:`/`fix:` + one-line summary, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).

---

### Task 1: Add `EL`/`ECL` competitions and the `visibleCompetitions()` helper

**Files:**
- Modify: `lib/types.ts` (widen `CompetitionId`)
- Modify: `lib/competitions.ts` (add two entries, add `visibleCompetitions()`)
- Test: `lib/competitions.test.ts` (new file — this module has no existing test file to extend)

**Interfaces:**
- Consumes: `Match` from `lib/types.ts` (existing).
- Produces: `CompetitionId` now includes `'EL' | 'ECL'` — consumed by every task in this plan and by every existing file that already imports `CompetitionId` (no signature changes needed elsewhere, it's an additive union widening). `export function visibleCompetitions(matches: Match[], from?: CompetitionMapping[]): CompetitionMapping[]` from `lib/competitions.ts` — consumed by Tasks 2, 3, 4.

- [ ] **Step 1: Widen `CompetitionId` in `lib/types.ts`**

Find this line:

```typescript
export type CompetitionId = 'PL' | 'CL' | 'FA' | 'EFL' | 'FRIENDLY';
```

Replace with:

```typescript
export type CompetitionId = 'PL' | 'CL' | 'EL' | 'ECL' | 'FA' | 'EFL' | 'FRIENDLY';
```

- [ ] **Step 2: Write the failing tests**

Create `lib/competitions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { COMPETITIONS, getCompetition, visibleCompetitions } from './competitions';
import type { Match } from './types';

function match(competition: Match['competition']): Match {
  return {
    id: 'x', utcDate: '2026-08-22T11:30:00Z', status: 'SCHEDULED', competition,
    home: { name: 'Hull City AFC' }, away: { name: 'Manchester United FC' }, venue: 'A',
    score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
    sources: { fd: 1 },
  };
}

describe('COMPETITIONS', () => {
  it('defines EL and ECL as ESPN-only, no standings, no fdCode — same pattern as FA/EFL', () => {
    const el = getCompetition('EL');
    const ecl = getCompetition('ECL');
    expect(el).toMatchObject({ espnSlug: 'uefa.europa', hasStandings: false, fdCode: undefined });
    expect(ecl).toMatchObject({ espnSlug: 'uefa.europa.conf', hasStandings: false, fdCode: undefined });
  });
});

describe('visibleCompetitions', () => {
  it('always includes non-European competitions, even with zero matches', () => {
    const result = visibleCompetitions([]);
    const ids = result.map(c => c.id);
    expect(ids).toContain('PL');
    expect(ids).toContain('FA');
    expect(ids).toContain('EFL');
    expect(ids).toContain('FRIENDLY');
  });

  it('excludes CL/EL/ECL entirely when MU has no match in any of them', () => {
    const result = visibleCompetitions([match('PL')]);
    const ids = result.map(c => c.id);
    expect(ids).not.toContain('CL');
    expect(ids).not.toContain('EL');
    expect(ids).not.toContain('ECL');
  });

  it('includes only the one European competition MU actually has a match in', () => {
    const result = visibleCompetitions([match('PL'), match('EL')]);
    const ids = result.map(c => c.id);
    expect(ids).toContain('EL');
    expect(ids).not.toContain('CL');
    expect(ids).not.toContain('ECL');
  });

  it('preserves COMPETITIONS declaration order (PL, then whichever European slot, then FA, EFL, FRIENDLY)', () => {
    const result = visibleCompetitions([match('PL'), match('CL')]);
    expect(result.map(c => c.id)).toEqual(['PL', 'CL', 'FA', 'EFL', 'FRIENDLY']);
  });

  it('accepts a pre-filtered candidate list via the second parameter, still applying the European rule', () => {
    const noFriendly = COMPETITIONS.filter(c => c.id !== 'FRIENDLY');
    const result = visibleCompetitions([match('PL')], noFriendly);
    expect(result.map(c => c.id)).toEqual(['PL', 'FA', 'EFL']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/competitions.test.ts`
Expected: FAIL — `getCompetition('EL')` throws `Unknown competition id: EL` (doesn't exist yet), and `visibleCompetitions` doesn't exist yet (TypeScript/import error).

- [ ] **Step 4: Add the two competitions and the helper to `lib/competitions.ts`**

Replace the full file with:

```typescript
import type { CompetitionId, Match } from './types';

export interface CompetitionMapping {
  id: CompetitionId;
  label: string;
  navShortLabel: string;
  fdCode?: 'PL' | 'CL';
  espnSlug: string;
  hasStandings: boolean;
}

export const COMPETITIONS: CompetitionMapping[] = [
  { id: 'PL', label: 'Premier League', navShortLabel: 'PL', fdCode: 'PL', espnSlug: 'eng.1', hasStandings: true },
  { id: 'CL', label: 'UEFA Champions League', navShortLabel: 'UCL', fdCode: 'CL', espnSlug: 'uefa.champions', hasStandings: true },
  // EL/ECL: football-data.org's free tier doesn't cover these (HANDOFF.md's API survey —
  // only PL/CL standings are free), so no fdCode and hasStandings: false, same as FA/EFL
  // below — they render via CupRun's round-by-round view, not a league table, even
  // though both competitions do have a real 36-team Swiss-format league phase on ESPN.
  // Wiring a second standings source for them is a separate, larger effort (see this
  // plan's Global Constraints).
  { id: 'EL', label: 'UEFA Europa League', navShortLabel: 'UEL', espnSlug: 'uefa.europa', hasStandings: false },
  { id: 'ECL', label: 'UEFA Europa Conference League', navShortLabel: 'UECL', espnSlug: 'uefa.europa.conf', hasStandings: false },
  { id: 'FA', label: 'FA Cup', navShortLabel: 'FA Cup', espnSlug: 'eng.fa', hasStandings: false },
  { id: 'EFL', label: 'Carabao Cup', navShortLabel: 'Carabao', espnSlug: 'eng.league_cup', hasStandings: false },
  { id: 'FRIENDLY', label: 'Friendly', navShortLabel: 'Friendly', espnSlug: 'club.friendly', hasStandings: false },
];

export function getCompetition(id: CompetitionId): CompetitionMapping {
  const found = COMPETITIONS.find(c => c.id === id);
  if (!found) throw new Error(`Unknown competition id: ${id}`);
  return found;
}

export function competitionIdForFdCode(code: string): CompetitionId | undefined {
  return COMPETITIONS.find(c => c.fdCode === code)?.id;
}

// MU plays in at most one of these three per season (or none) — never more than one,
// and it's not the same one every year (depends on the prior season's finish). Showing
// all three as permanent tabs would mean two of them are dead all season, unlike FA/EFL
// (which are always relevant at the start of a season and only go quiet after MU is
// knocked out) — so these three are hidden entirely unless MU actually has a fixture in
// them, while every other competition keeps its current always-shown behavior.
const EUROPEAN_COMPETITION_IDS: CompetitionId[] = ['CL', 'EL', 'ECL'];

export function visibleCompetitions(matches: Match[], from: CompetitionMapping[] = COMPETITIONS): CompetitionMapping[] {
  return from.filter(c =>
    !EUROPEAN_COMPETITION_IDS.includes(c.id) || matches.some(m => m.competition === c.id),
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/competitions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — this step also confirms the `CompetitionId` widening didn't break any existing exhaustiveness check or switch statement elsewhere in the codebase (there shouldn't be any, since the union was only ever pattern-matched via `.filter`/`.find`/`===`, never an exhaustive `switch`, but this is where it would surface if one exists).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/competitions.ts lib/competitions.test.ts
git commit -m "feat: add Europa League/Conference League, add visibleCompetitions() helper"
```

---

### Task 2: Dynamic European tab on the Schedule page (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: `visibleCompetitions` from `lib/competitions.ts` (Task 1).
- Produces: nothing consumed by another task.

- [ ] **Step 1: Write the failing test**

This file already defines `function match(id: string, competition: MatchesResponse['matches'][number]['competition'], opponent: string, utcDate = '2026-08-22T11:30:00Z')` near the top — use it as-is. Add this test inside the existing `describe('SchedulePage', ...)` block:

```typescript
  it('only shows a European tab (CL/EL/ECL) when MU actually has a match in one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        season: '2026-27',
        matches: [match('a', 'PL', 'Arsenal FC'), match('b', 'EL', 'Some European Side')],
        meta: { sources: { fd: true, espn: true } },
      }),
    }));

    render(<SchedulePage />);
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));

    expect(screen.getByRole('tab', { name: 'UEL' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UCL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UECL' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/page.test.tsx`
Expected: The new test FAILS (the `UCL`/`UECL` tabs — or in this fixture's case, since no CL/ECL match exists, the assertions about `UEL` presence fail instead, since today's `COMPETITIONS.map(...)` always renders GDP `UCL`/`FA Cup`/`Carabao`/`Friendly` but never a `UEL` tab at all — `getByRole('tab', { name: 'UEL' })` fails to find it). All previously-existing tests in this file still PASS unchanged.

- [ ] **Step 3: Use `visibleCompetitions` for the tab list**

In `app/page.tsx`, add the import:

```typescript
import { COMPETITIONS, visibleCompetitions } from '@/lib/competitions';
```

(This replaces the existing `import { COMPETITIONS } from '@/lib/competitions';` line.)

Change:

```tsx
        {COMPETITIONS.map(c => (
```

to:

```tsx
        {visibleCompetitions(data.matches).map(c => (
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "fix: only show a European tab on Schedule when MU has a match in it"
```

---

### Task 3: Dynamic European tab on the Stats page (`app/stats/page.tsx`)

**Files:**
- Modify: `app/stats/page.tsx`
- Modify: `app/stats/page.test.tsx`

**Interfaces:**
- Consumes: `visibleCompetitions` from `lib/competitions.ts` (Task 1).
- Produces: nothing consumed by another task.

**Context:** This page already filters `FRIENDLY` out of its tab list via a local `competitiveCompetitions = COMPETITIONS.filter(c => c.id !== 'FRIENDLY')` (from a prior fix). This task adds the European rule on top of that existing filter, via `visibleCompetitions`'s second parameter.

- [ ] **Step 1: Write the failing test**

In `app/stats/page.test.tsx`, add (using this file's existing `match(...)` helper and `stubMatches` helper, both already defined at the top of the file):

```typescript
  it('only shows a European tab (CL/EL/ECL) when MU actually has a match in one', async () => {
    stubMatches([
      match({ id: 'a', competition: 'PL' }),
      match({ id: 'b', competition: 'ECL' }),
    ]);

    render(<StatsPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('tab', { name: 'UECL' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UCL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UEL' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: The new test FAILS — no `UECL` tab exists yet. All previously-existing tests in this file still PASS unchanged.

- [ ] **Step 3: Use `visibleCompetitions` for the tab list**

In `app/stats/page.tsx`, add the import:

```typescript
import { COMPETITIONS, visibleCompetitions } from '@/lib/competitions';
```

(Replaces the existing `import { COMPETITIONS } from '@/lib/competitions';` line.)

Change:

```typescript
  const competitiveCompetitions = COMPETITIONS.filter(c => c.id !== 'FRIENDLY');
```

to:

```typescript
  const competitiveCompetitions = visibleCompetitions(
    competitiveMatches,
    COMPETITIONS.filter(c => c.id !== 'FRIENDLY'),
  );
```

(`competitiveMatches` is the existing `data.matches.filter(m => m.competition !== 'FRIENDLY')` variable already defined just above this line — no change to that line.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/stats/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/stats/page.tsx app/stats/page.test.tsx
git commit -m "fix: only show a European tab on Stats when MU has a match in it"
```

---

### Task 4: Dynamic European tab + generic standings/CupRun routing on Standings (`app/standings/page.tsx`)

**Files:**
- Modify: `app/standings/page.tsx`
- Modify: `app/standings/page.test.tsx`
- Modify: `components/CupRun.tsx` (widen the `competition` prop type)

**Interfaces:**
- Consumes: `visibleCompetitions`, `CompetitionMapping` from `lib/competitions.ts` (Task 1); `getCompetition` (existing import, already used in this file).
- Produces: nothing consumed by another task — this is the plan's last code task.

**Context:** This page currently hardcodes `type Tab = 'PL' | 'CL' | 'FA' | 'EFL'`, a hardcoded tab-button array `(['PL', 'CL', 'FA', 'EFL'] as const)`, and two hardcoded conditions — `tab === 'PL' || tab === 'CL'` (render the standings table) and `tab === 'FA' || tab === 'EFL'` (render `CupRun`). All three need to generalize to work for any competition, driven by `getCompetition(tab).hasStandings` instead of a hardcoded id list — this is what makes `EL`/`ECL` (and any future competition) route to the right branch automatically without a third hardcoded condition.

- [ ] **Step 1: Read the current file and locate the exact lines**

Run: `grep -n "type Tab\|as const\|tab === \|hasStandings" app/standings/page.tsx`

You should find: the `type Tab = 'PL' | 'CL' | 'FA' | 'EFL';` declaration, the `loadStandings` function's early-return guard (`if (selectedTab !== 'PL' && selectedTab !== 'CL') return;`), the tab-button-list line (`(['PL', 'CL', 'FA', 'EFL'] as const).map(...)`), the standings-table-vs-nothing condition (`{(tab === 'PL' || tab === 'CL') && (...)}`), and the `CupRun` condition (`{(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}`).

- [ ] **Step 2: Write the failing tests**

In `app/standings/page.test.tsx`:

1. Fix the existing CL-highlight test's fixture — under the new rule the `UCL` tab won't render at all with an empty `matches: []`, so it needs a CL match present. Find this test:

```typescript
  it('shows a "Red Devils\' Position" highlight block on the CL tab, but not on PL', async () => {
    const bigTable = Array.from({ length: 36 }, (_, i) =>
      i === 17 ? standingsRow(18, 'Manchester United FC') : standingsRow(i + 1, `Team ${i + 1}`),
    );
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: bigTable }) });
      return Promise.resolve({ ok: true, json: async () => ({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } }) });
    }));
```

Change the `matches: []` to include one CL fixture, so the `UCL` tab exists to click:

```typescript
  it('shows a "Red Devils\' Position" highlight block on the CL tab, but not on PL', async () => {
    const bigTable = Array.from({ length: 36 }, (_, i) =>
      i === 17 ? standingsRow(18, 'Manchester United FC') : standingsRow(i + 1, `Team ${i + 1}`),
    );
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: bigTable }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'cl1', utcDate: '2026-09-17T19:00:00Z', status: 'SCHEDULED', competition: 'CL',
            home: { name: 'Manchester United FC' }, away: { name: 'Some European Side' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));
```

2. Add a new test for the dynamic European tab rule (place it near the other tab-related tests):

```typescript
  it('only shows a European tab (CL/EL/ECL) when MU actually has a match in one, and routes it to CupRun', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) return Promise.resolve({ json: async () => ({ standings: [] }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'el1', utcDate: '2026-09-17T19:00:00Z', status: 'SCHEDULED', competition: 'EL',
            home: { name: 'Manchester United FC' }, away: { name: 'Some Europa Side' }, venue: 'H',
            score: { fullTime: { home: null, away: null }, display: { home: null, away: null } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    expect(screen.getByRole('tab', { name: 'UEL' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'UCL' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'UEL' }));
    await waitFor(() => expect(screen.getByText(/Some Europa Side/)).toBeInTheDocument());
  });
```

- [ ] **Step 3: Run the tests to verify the new one fails**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: The fixed CL-highlight test now passes its own fixture change trivially (no behavior change yet, just fixture data — this test may still pass or fail depending on whether the UCL tab logic has changed yet; if the file hasn't been modified yet in Step 4, this test still passes today since PL/CL are still hardcoded-always-shown). The new "only shows a European tab..." test FAILS — no `UEL` tab exists yet (today's hardcoded list is `PL`/`CL`/`FA`/`EFL` only, `EL` isn't in it at all).

- [ ] **Step 4: Generalize the `Tab` type, tab list, and branching**

In `app/standings/page.tsx`:

Replace the import line:

```typescript
import { getCompetition } from '@/lib/competitions';
```

with:

```typescript
import { COMPETITIONS, getCompetition, visibleCompetitions } from '@/lib/competitions';
```

Replace:

```typescript
type Tab = 'PL' | 'CL' | 'FA' | 'EFL';
```

with:

```typescript
type Tab = Exclude<CompetitionId, 'FRIENDLY'>;
```

(This requires importing `CompetitionId` — add it to the existing `import type { Match, MatchesResponse, StandingRow } from '@/lib/types';` line, making it `import type { CompetitionId, Match, MatchesResponse, StandingRow } from '@/lib/types';`.)

Replace the `loadStandings` guard:

```typescript
    if (selectedTab !== 'PL' && selectedTab !== 'CL') return;
```

with:

```typescript
    if (!getCompetition(selectedTab).hasStandings) return;
```

Replace the tab-change effect's guard similarly — find:

```typescript
    if (tab !== 'PL' && tab !== 'CL') { setStandings(null); return; }
```

replace with:

```typescript
    if (!getCompetition(tab).hasStandings) { setStandings(null); return; }
```

Replace the `muForm` line:

```typescript
  const muForm = (tab === 'PL' || tab === 'CL') ? recentForm(matches, tab, 5) : [];
```

with:

```typescript
  const muForm = getCompetition(tab).hasStandings ? recentForm(matches, tab, 5) : [];
```

Replace the hardcoded tab-button list:

```tsx
      <div role="tablist" className={styles.tabs}>
        {(['PL', 'CL', 'FA', 'EFL'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={styles.tab}>
            {getCompetition(t).navShortLabel}
          </button>
        ))}
      </div>
```

with:

```tsx
      <div role="tablist" className={styles.tabs}>
        {visibleCompetitions(matches, COMPETITIONS.filter(c => c.id !== 'FRIENDLY')).map(c => (
          <button key={c.id} role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)} className={styles.tab}>
            {c.navShortLabel}
          </button>
        ))}
      </div>
```

Replace the standings-table condition:

```tsx
      {(tab === 'PL' || tab === 'CL') && (
```

with:

```tsx
      {getCompetition(tab).hasStandings && (
```

Replace the CupRun condition and its `competition` prop:

```tsx
      {(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}
```

with:

```tsx
      {!getCompetition(tab).hasStandings && <CupRun matches={matches} competition={tab} />}
```

Also check the CL-only highlight-block condition a few lines above the standings table — it currently reads:

```tsx
            {tab === 'CL' && standingsAroundMu(standings, 2).length > 0 && (
```

Leave this line **unchanged** — the highlight block (windowed table around MU's position) is specific to CL's known 36-team Swiss-format size; EL/ECL don't reach this branch at all (they route to `CupRun` per `hasStandings: false`), so there's nothing to generalize here yet. This is consistent with the Global Constraints' note that a real EL/ECL standings table is out of scope.

- [ ] **Step 5: Widen `CupRun`'s `competition` prop type**

In `components/CupRun.tsx`, find:

```typescript
export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' }) {
```

Replace with:

```typescript
export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' | 'EL' | 'ECL' }) {
```

(No other change to this file — the component's logic already just filters `matches` by the given `competition` id and doesn't otherwise care which one it is.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run app/standings/page.test.tsx components/CupRun.test.tsx`
Expected: PASS (all tests, old and new)

- [ ] **Step 7: Run the full suite, typecheck, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: PASS; build succeeds with no new errors.

- [ ] **Step 8: Commit**

```bash
git add app/standings/page.tsx app/standings/page.test.tsx components/CupRun.tsx
git commit -m "fix: generalize Standings' tab routing, only show a European tab when relevant"
```

---

## Self-Review Notes

- **Spec coverage:** the user's confirmed decision — "only show a European tab when MU actually has a match in it, leave PL/FA/EFL alone" — is implemented once (`visibleCompetitions` in Task 1) and reused identically by all three tab-rendering pages (Tasks 2, 3, 4), so there's exactly one place the rule lives, not three copies that could drift. The data-fetching side (why Europa/Conference matches weren't being fetched at all) is fixed by Task 1's two new `COMPETITIONS` entries alone — every API route (`/api/matches`, `/api/leaders`) already iterates `COMPETITIONS` generically and needs no changes.
- **Placeholder scan:** none — every step has complete, runnable code, and every step that says "find this line" gives the exact current line to search for.
- **Type consistency:** `CompetitionId`'s widening (Task 1) is additive only (no existing literal removed), so every existing consumer (`Match.competition`, `CompetitionMapping.id`, every page's `FilterValue`/`Tab` type built from it) keeps compiling without change except Standings' `Tab` type, which Task 4 explicitly updates from its old hardcoded 4-value union to `Exclude<CompetitionId, 'FRIENDLY'>`. `visibleCompetitions(matches: Match[], from?: CompetitionMapping[]): CompetitionMapping[]`'s signature is used identically in Tasks 2, 3, and 4.
- **Known limitation flagged, not silently dropped:** EL/ECL not having a real league-phase standings table (unlike CL) is called out explicitly in the Global Constraints and again at the point in Task 4 where it'd be tempting to "just generalize" the CL-only highlight-block condition — left alone on purpose, not an oversight.
