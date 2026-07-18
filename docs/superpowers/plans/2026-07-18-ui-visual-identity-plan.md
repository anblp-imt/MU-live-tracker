# UI Visual Identity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle MU Live Tracker from bare unstyled HTML into a retro "matchday programme" identity (aged gold, dashed ticket-stub cards, Playfair Display/Inter/IBM Plex Mono), fully responsive, per `docs/superpowers/specs/2026-07-18-ui-visual-identity-design.md`.

**Architecture:** Presentational pass only — every existing component keeps its current props/state/data-fetching. Adds CSS Modules per component, one shared `displayTeamName()` text utility, one small derived-data helper (`recentForm`), and two real (small) fixes: wiring up already-tested-but-unused `LiveBadge`, and hiding the shared nav pills on `/standings` to remove a duplicate selector.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules (no component library — matches the original design spec's "CSS Modules + pure hooks" constraint), Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies — CSS Modules + hand-written hooks only (original design spec section 6, reaffirmed in this spec's section 10a).
- Design tokens live in `app/globals.css` `:root`; every component-level `.module.css` file consumes them via `var(--mu-*)`/`var(--font-*)`, never hardcodes a hex color that already has a token.
- Single responsive breakpoint: `max-width: 640px`, used identically everywhere (spec section 10).
- Never fabricate data the app doesn't have — no invented round numbers, no invented issue numbers, no invented per-team "form" for teams other than MU (spec sections 4, 7d, and this plan's Task 9 clarification below).
- Run `npm test`, `npm run typecheck` after every task; run `npm run build` at Tasks 6, 9, 10, and 12 (the tasks touching route pages most likely to reveal a build-time issue).
- Every commit message follows this repo's existing style (`feat:`/`fix:`/`chore:` + one-line summary).

---

### Task 1: Design tokens foundation

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--mu-red`, `--mu-red-dark`, `--mu-black`, `--mu-surface`, `--mu-gold`, `--mu-gold-bright`, `--mu-green`, `--mu-white`, `--font-heading`, `--font-body`, `--font-mono` — consumed by every task from Task 3 onward. Restyled `.badge-live`/`.badge-ht`/`.badge-fergie` global classes — consumed by Task 5.

- [ ] **Step 1: Replace the token block, font imports, and badge classes**

Replace the entire contents of `app/globals.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --mu-red: #DA291C;
  --mu-red-dark: #9A1F14;
  --mu-black: #0d0d0d;
  --mu-surface: #161310;
  --mu-gold: #C9A227;
  --mu-gold-bright: #FFD700;
  --mu-green: #3fae5c;
  --mu-white: #EDE6D6;
  --font-heading: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--mu-black);
  color: var(--mu-white);
  font-family: var(--font-body);
  margin: 0;
}

h1, h2, h3 {
  font-family: var(--font-heading);
  font-weight: 900;
  color: var(--mu-red);
}

a {
  color: var(--mu-gold);
}

.badge-live {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mu-red);
  background: rgba(218, 41, 28, 0.15);
  border: 1px solid rgba(218, 41, 28, 0.4);
  padding: 2px 7px;
  border-radius: 1px;
}

.badge-ht {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mu-gold);
  background: rgba(201, 162, 39, 0.15);
  border: 1px solid rgba(201, 162, 39, 0.4);
  padding: 2px 7px;
  border-radius: 1px;
}

.badge-fergie {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0d0d0d;
  background: var(--mu-gold-bright);
  padding: 2px 7px;
  border-radius: 1px;
  animation: fergie-pulse 1s infinite;
}

@keyframes fergie-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — pure CSS/token changes don't affect any RTL text/role assertions (verified: no test in this codebase queries by color or computed style).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: rework design tokens for the retro matchday-programme identity"
```

---

### Task 2: `displayTeamName()` utility

**Files:**
- Modify: `lib/normalize.ts`
- Test: `lib/normalize.test.ts`

**Interfaces:**
- Consumes: `isManUtd(name: string): boolean` (already exists in this file).
- Produces: `displayTeamName(name: string): string` — consumed by Task 9 (Standings), Task 10 (Match detail header), Task 11 (Formation pitch team labels).

- [ ] **Step 1: Write the failing tests**

Add to `lib/normalize.test.ts` (after the existing `isManUtd` describe block):

```ts
describe('displayTeamName', () => {
  it('returns "Red Devils" for Manchester United, from either data source', () => {
    expect(displayTeamName('Manchester United FC')).toBe('Red Devils');
    expect(displayTeamName('Manchester United')).toBe('Red Devils');
  });

  it('returns the name unchanged for any other club', () => {
    expect(displayTeamName('Arsenal FC')).toBe('Arsenal FC');
  });
});
```

Update the import at the top of the file:

```ts
import { normalizeTeamName, isManUtd, displayTeamName } from './normalize';
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/normalize.test.ts`
Expected: FAIL — `displayTeamName` is not exported.

- [ ] **Step 3: Implement**

Add to `lib/normalize.ts` (after `isManUtd`):

```ts
export function displayTeamName(name: string): string {
  return isManUtd(name) ? 'Red Devils' : name;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run lib/normalize.test.ts`
Expected: PASS — 5 tests (3 existing + 2 new).

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add lib/normalize.ts lib/normalize.test.ts
git commit -m "feat: add displayTeamName() — shows MU as \"Red Devils\" at display time"
```

---

### Task 3: Competition `navShortLabel` + responsive pill styling

**Files:**
- Modify: `lib/competitions.ts`
- Modify: `lib/competitions.test.ts`
- Modify: `components/CompetitionFilterPills.tsx`
- Create: `components/CompetitionFilterPills.module.css`
- Modify: `components/CompetitionFilterPills.test.tsx`

**Interfaces:**
- Consumes: design tokens (Task 1).
- Produces: `CompetitionMapping.navShortLabel: string` — not consumed elsewhere in this plan (display-only), but is now part of the `CompetitionMapping` shape any future task must preserve.

**Note on why `aria-label` is used below:** this component's tests run in jsdom via Vitest without a real CSS engine loaded (confirmed: `vitest.config.ts` has no `css: true`), so a CSS `display:none` media-query toggle between two label spans would NOT actually hide either span's text during tests — both would count toward the button's accessible name and break the existing `getByRole('tab', { name: 'Premier League' })` test. Setting `aria-label` on the `<button>` pins its accessible name explicitly, independent of which child span is visually shown — this works identically in the browser and in tests.

- [ ] **Step 1: Write the failing test for `navShortLabel`**

Add to `lib/competitions.test.ts` (inside the existing `describe` block):

```ts
  it('has a navShortLabel short enough to fit unwrapped in a mobile nav pill', () => {
    expect(COMPETITIONS.map(c => c.navShortLabel)).toEqual(['PL', 'UCL', 'FA Cup', 'Carabao', 'Friendly']);
  });
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/competitions.test.ts`
Expected: FAIL — `navShortLabel` is `undefined` on every entry.

- [ ] **Step 3: Add the field**

Replace `lib/competitions.ts` in full:

```ts
import type { CompetitionId } from './types';

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
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run lib/competitions.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the failing test for dual full/short labels**

Add to `components/CompetitionFilterPills.test.tsx` (inside the existing `describe` block):

```ts
  it('renders both the full and short label for responsive nav pills', () => {
    render(<CompetitionFilterPills selected="ALL" onSelect={() => {}} />);
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('PL')).toBeInTheDocument();
    expect(screen.getByText('UEFA Champions League')).toBeInTheDocument();
    expect(screen.getByText('UCL')).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run and see it fail**

Run: `npx vitest run components/CompetitionFilterPills.test.tsx`
Expected: FAIL — no element with text "PL" (only "Premier League" currently renders).

- [ ] **Step 7: Implement the component and its module CSS**

Replace `components/CompetitionFilterPills.tsx` in full:

```tsx
import type { CompetitionId } from '@/lib/types';
import { COMPETITIONS } from '@/lib/competitions';
import styles from './CompetitionFilterPills.module.css';

export type FilterValue = CompetitionId | 'ALL';

// [React] This component holds no useState — it's fully "controlled" by its parent via
// `selected`/`onSelect` props. That's what makes lifting state up possible: the parent
// (or later, a Context provider) owns the one source of truth, and every consumer of it
// re-renders in sync automatically.
//
// Each pill renders both a full and short label, toggled by a CSS media query — no
// viewport-detection JS, no hydration-mismatch risk. `aria-label` pins the tab's
// accessible name to the full label regardless of which span is visually shown, so
// screen readers (and tests, which run without a real CSS engine) see one stable name
// instead of the concatenation of both spans.
export function CompetitionFilterPills({ selected, onSelect }: { selected: FilterValue; onSelect: (value: FilterValue) => void }) {
  return (
    <div role="tablist" aria-label="Filter by competition" className={styles.pills}>
      <button role="tab" aria-selected={selected === 'ALL'} aria-label="All" onClick={() => onSelect('ALL')} className={styles.pill}>
        <span aria-hidden="true">All</span>
      </button>
      {COMPETITIONS.map(c => (
        <button key={c.id} role="tab" aria-selected={selected === c.id} aria-label={c.label} onClick={() => onSelect(c.id)} className={styles.pill}>
          <span aria-hidden="true" className={styles.full}>{c.label}</span>
          <span aria-hidden="true" className={styles.short}>{c.navShortLabel}</span>
        </button>
      ))}
    </div>
  );
}
```

Create `components/CompetitionFilterPills.module.css`:

```css
.pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  font-family: var(--font-body);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 5px 10px;
  border: 1px solid rgba(201, 162, 39, 0.3);
  border-radius: 2px;
  background: transparent;
  color: var(--mu-gold);
  cursor: pointer;
}

.pill[aria-selected="true"] {
  border-color: var(--mu-red);
  background: rgba(218, 41, 28, 0.15);
  color: var(--mu-white);
}

.short {
  display: none;
}

@media (max-width: 640px) {
  .full {
    display: none;
  }
  .short {
    display: inline;
  }
}
```

- [ ] **Step 8: Run and see it pass**

Run: `npx vitest run components/CompetitionFilterPills.test.tsx`
Expected: PASS — 4 tests (3 existing + 1 new). The pre-existing `getByRole('tab', { name: 'Premier League' })` test still passes because `aria-label` supplies that name directly.

- [ ] **Step 9: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add lib/competitions.ts lib/competitions.test.ts components/CompetitionFilterPills.tsx components/CompetitionFilterPills.module.css components/CompetitionFilterPills.test.tsx
git commit -m "feat: style competition pills, add responsive short labels below 640px"
```

---

### Task 4: Hide the shared nav pills on `/standings`

**Files:**
- Modify: `components/NavFilterPills.tsx`
- Create: `components/NavFilterPills.test.tsx`

**Interfaces:**
- Consumes: `CompetitionFilterPills` (Task 3), `useCompetitionFilter` (existing, `contexts/CompetitionFilterContext.tsx`), `usePathname` (`next/navigation`).
- Produces: nothing new consumed elsewhere — `app/layout.tsx` is untouched, it already renders `<NavFilterPills />` unconditionally and that continues to be correct (the conditional now lives inside `NavFilterPills` itself).

- [ ] **Step 1: Write the failing tests**

Create `components/NavFilterPills.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavFilterPills } from './NavFilterPills';
import { CompetitionFilterProvider } from '@/contexts/CompetitionFilterContext';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('NavFilterPills', () => {
  it('renders the shared filter pills on Today', () => {
    mockPathname = '/';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders the shared filter pills on Schedule', () => {
    mockPathname = '/schedule';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders nothing on Standings — that page has its own competition tabs', () => {
    mockPathname = '/standings';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
```

Add `vi` to the vitest import: `import { describe, it, expect, vi } from 'vitest';`

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run components/NavFilterPills.test.tsx`
Expected: FAIL on the third test — `NavFilterPills` doesn't check the path yet, so the tablist renders on `/standings` too.

- [ ] **Step 3: Implement**

Replace `components/NavFilterPills.tsx` in full:

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { CompetitionFilterPills } from './CompetitionFilterPills';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';

// [React] Standings has its own local PL/CL/FA/EFL tabs (Task 26's deliberate
// local-state-vs-Context teaching contrast) — showing the shared nav pills there too
// reads as two competition selectors doing overlapping jobs. This conditional is the
// only change; CompetitionFilterContext and Standings' own useState tab are untouched.
export function NavFilterPills() {
  const pathname = usePathname();
  const { selected, setSelected } = useCompetitionFilter();
  if (pathname?.startsWith('/standings')) return null;
  return <CompetitionFilterPills selected={selected} onSelect={setSelected} />;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/NavFilterPills.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add components/NavFilterPills.tsx components/NavFilterPills.test.tsx
git commit -m "fix: hide the shared nav pills on /standings (duplicate competition selector)"
```

---

### Task 5: Match card restyle + wire up `LiveBadge`

**Files:**
- Modify: `components/MatchCard.tsx`
- Modify: `components/MatchCard.module.css`

**Interfaces:**
- Consumes: `LiveBadge` (existing, `components/LiveBadge.tsx` — unchanged), design tokens (Task 1).
- Produces: nothing new consumed elsewhere.

**Finding this task fixes:** `LiveBadge.tsx` has full logic and test coverage but was never actually rendered — `MatchCard` only imported `isFergieTime` from it and re-implemented the label as plain text via `statusLabel()`. `LiveBadge`'s rendered text output (`HT`, `FERGIE TIME`, `{minute}'`) is identical to what `statusLabel()` currently produces for those same states, so swapping the render path doesn't change any visible text — `LiveBadge.test.tsx` needs no changes, and `MatchCard.test.tsx`'s existing `'shows HT for a PAUSED match'` and `'shows FERGIE TIME...'` tests keep passing unchanged.

- [ ] **Step 1: Confirm current tests pass before changing anything**

Run: `npx vitest run components/MatchCard.test.tsx components/LiveBadge.test.tsx`
Expected: PASS — 9 tests total (both files already exist and pass; this is the baseline to preserve).

- [ ] **Step 2: Implement**

Replace `components/MatchCard.tsx` in full:

```tsx
import Link from 'next/link';
import type { Match } from '@/lib/types';
import { getCompetition } from '@/lib/competitions';
import { isFergieTime, LiveBadge } from './LiveBadge';
import styles from './MatchCard.module.css';

const CLICKABLE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED', 'FINISHED'];
const LIVE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED'];

function statusLabel(match: Match): string {
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'POSTPONED') return 'Postponed';
  return new Date(match.utcDate).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function cardStateClass(match: Match): string {
  if (LIVE_STATUSES.includes(match.status)) return styles.live;
  if (match.status === 'FINISHED') return styles.finished;
  return styles.scheduled;
}

export function MatchCard({ match }: { match: Match }) {
  const opponent = match.venue === 'H' ? match.away.name : match.home.name;
  const clickable = CLICKABLE_STATUSES.includes(match.status);
  const isLive = LIVE_STATUSES.includes(match.status);

  const content = (
    <div className={`${styles.card} ${cardStateClass(match)}`} data-testid="match-card">
      {isLive && (
        <div className={styles.stamp}>
          <LiveBadge match={match} />
        </div>
      )}
      <span className={styles.opponent}>vs {opponent} ({match.venue})</span>
      <span className={styles.score}>{match.score.display.home ?? '-'} : {match.score.display.away ?? '-'}</span>
      {!isLive && <span className={styles.meta}>{statusLabel(match)}</span>}
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

Note: `isFergieTime` is imported but no longer directly called in this file (it's used internally by `LiveBadge`). TypeScript will flag it as unused — remove it from the import if so. Check with the typecheck step below; if `isFergieTime` shows an unused-import error, change the import line to: `import { LiveBadge } from './LiveBadge';`

Replace `components/MatchCard.module.css` in full:

```css
.card {
  position: relative;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 12px 14px;
  background: var(--mu-surface);
  border: 1.5px dashed;
  border-radius: 3px;
  font-family: var(--font-body);
}

.live {
  border-color: rgba(201, 162, 39, 0.5);
}

.finished {
  border-color: rgba(255, 255, 255, 0.14);
}

.scheduled {
  border-color: rgba(255, 255, 255, 0.08);
  opacity: 0.75;
}

.stamp {
  position: absolute;
  top: -9px;
  left: 12px;
}

.opponent {
  flex: 1;
  font-weight: 600;
}

.score {
  font-family: var(--font-mono);
  color: var(--mu-gold);
}

.meta {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.6;
}
```

- [ ] **Step 3: Run and see it pass**

Run: `npx vitest run components/MatchCard.test.tsx components/LiveBadge.test.tsx`
Expected: PASS — same 9 tests as Step 1, unchanged.

- [ ] **Step 4: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add components/MatchCard.tsx components/MatchCard.module.css
git commit -m "feat: restyle MatchCard as a ticket stub, wire up the previously-unused LiveBadge"
```

---

### Task 6: `PageHeading` component, wired into Today and Schedule

**Files:**
- Create: `components/PageHeading.tsx`
- Create: `components/PageHeading.module.css`
- Create: `components/PageHeading.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `app/schedule/page.tsx`
- Create: `app/schedule/page.module.css`

**Interfaces:**
- Consumes: design tokens (Task 1).
- Produces: `PageHeading({ title: string })` — consumed by Task 9 (Standings page heading).

**Note found during planning:** `app/page.module.css` already exists but is dead code — it's the unused `create-next-app` scaffold boilerplate from Task 1 of the original 28-task plan (`.intro`/`.ctas`/etc. classes, never imported anywhere — confirmed via `grep -rn "page.module.css" app/`, zero matches). This task repurposes that file for its real, matching name (`app/page.tsx`'s module) rather than adding a second file.

- [ ] **Step 1: Write the failing test**

Create `components/PageHeading.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeading } from './PageHeading';

describe('PageHeading', () => {
  it('renders the title as an h1', () => {
    render(<PageHeading title="Today" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('renders the retro kicker line with a date', () => {
    render(<PageHeading title="Today" />);
    expect(screen.getByText(/Matchday Programme/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run components/PageHeading.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/PageHeading.tsx`:

```tsx
import styles from './PageHeading.module.css';

// [React] Shared by Today, Schedule, and Standings (Task 9) — a plain reusable
// component rather than copy-pasting the same rule+kicker markup three times.
export function PageHeading({ title }: { title: string }) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <h1>{title}</h1>
      <div className={styles.rule} />
      <p className={styles.kicker}>Matchday Programme · {date}</p>
    </>
  );
}
```

Create `components/PageHeading.module.css`:

```css
.rule {
  height: 1px;
  background: linear-gradient(90deg, var(--mu-gold), transparent);
  width: 65%;
  margin: 7px 0 4px;
}

.kicker {
  font-family: var(--font-body);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.65;
  margin: 0 0 16px;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/PageHeading.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Wire into the Today page**

In `app/page.tsx`, add the import and replace the `<h1>`:

```tsx
import { PageHeading } from '@/components/PageHeading';
```

Change:
```tsx
      <h1>Today</h1>
```
to:
```tsx
      <PageHeading title="Today" />
```

Replace `app/page.module.css` in full (repurposing the dead scaffold file — see note above):

```css
.main {
  padding: 1.5rem;
}
```

Add the import and class to the `<main>` element in `app/page.tsx`:

```tsx
import styles from './page.module.css';
```

Change:
```tsx
  return (
    <main>
```
to:
```tsx
  return (
    <main className={styles.main}>
```

- [ ] **Step 6: Wire into the Schedule page**

In `app/schedule/page.tsx`, add imports and replace the `<h1>`:

```tsx
import { PageHeading } from '@/components/PageHeading';
import styles from './page.module.css';
```

Change:
```tsx
    <main>
      <h1>Schedule</h1>
```
to:
```tsx
    <main className={styles.main}>
      <PageHeading title="Schedule" />
```

Create `app/schedule/page.module.css`:

```css
.main {
  padding: 1.5rem;
}
```

- [ ] **Step 7: Run the affected suites and confirm nothing broke**

Run: `npx vitest run app/page.test.tsx app/schedule/page.test.tsx components/PageHeading.test.tsx`
Expected: PASS — neither existing test file queries the `<h1>` directly (both query match text/roles), so the heading swap doesn't break them.

- [ ] **Step 8: Full suite, typecheck, build, commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

```bash
git add components/PageHeading.tsx components/PageHeading.module.css components/PageHeading.test.tsx app/page.tsx app/page.module.css app/schedule/page.tsx app/schedule/page.module.css
git commit -m "feat: add PageHeading (retro rule+kicker), wire into Today and Schedule"
```

---

### Task 7: Cup Run restyle

**Files:**
- Modify: `components/CupRun.tsx`
- Create: `components/CupRun.module.css`

**Interfaces:**
- Consumes: design tokens (Task 1).
- Produces: nothing new consumed elsewhere.

**Confirms out of scope (spec section 7d):** no round-number label — `Match` has no round/matchday field, so this stays date + opponent + score, restyled only.

- [ ] **Step 1: Confirm current tests pass before changing anything**

Run: `npx vitest run components/CupRun.test.tsx`
Expected: PASS — 2 tests (existing baseline).

- [ ] **Step 2: Implement**

Replace `components/CupRun.tsx` in full:

```tsx
// [React] No useMemo here, unlike FormationPitch: this filter+sort runs over a
// handful of cup fixtures, and its result isn't handed to an expensive child — the cost
// of recomputing on every render is negligible. Reach for useMemo when profiling shows a
// real cost, not by default; see FormationPitch for the contrasting case.
import type { Match } from '@/lib/types';
import styles from './CupRun.module.css';

export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' }) {
  const rounds = matches
    .filter(m => m.competition === competition)
    .slice()
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (rounds.length === 0) {
    return <p>No fixtures yet this season.</p>;
  }

  return (
    <ol data-testid="cup-run" className={styles.list}>
      {rounds.map(m => (
        <li key={m.id} className={styles.row}>
          <span>{new Date(m.utcDate).toLocaleDateString('en-GB')} — vs {m.venue === 'H' ? m.away.name : m.home.name} ({m.venue})</span>
          <span className={styles.score}>{m.score.display.home ?? '-'}:{m.score.display.away ?? '-'}</span>
        </li>
      ))}
    </ol>
  );
}
```

Create `components/CupRun.module.css`:

```css
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(255, 255, 255, 0.14);
  border-radius: 3px;
  font-family: var(--font-body);
}

.score {
  font-family: var(--font-mono);
  color: var(--mu-gold);
  flex-shrink: 0;
}
```

- [ ] **Step 3: Run and see it pass**

Run: `npx vitest run components/CupRun.test.tsx`
Expected: PASS — same 2 tests, unchanged (both assertions check text content via `toHaveTextContent`, which matches regardless of the new internal `<span>` wrapping).

- [ ] **Step 4: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add components/CupRun.tsx components/CupRun.module.css
git commit -m "feat: restyle CupRun with the ticket-stub card treatment"
```

---

### Task 8: `recentForm()` — MU's own last-N results

**Files:**
- Create: `lib/standings.ts`
- Create: `lib/standings.test.ts`

**Interfaces:**
- Consumes: `Match`, `CompetitionId` (`lib/types.ts`).
- Produces: `recentForm(matches: Match[], competition: CompetitionId, limit?: number): ('W' | 'D' | 'L')[]` — consumed by Task 9 (Standings table Form column).

**Scope clarification found during planning:** the app only ever fetches MU's own matches (`MatchesResponse.matches` — this is a Manchester-United-only tracker), so `recentForm` can only ever compute *MU's* recent results, never another club's. Task 9 uses this function's output only on MU's own standings row; every other row shows a neutral placeholder, since the app genuinely has no data for other clubs' match histories. This is the spec's own section 7c wording ("finished MU matches") made explicit — not a scope change.

- [ ] **Step 1: Write the failing tests**

Create `lib/standings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recentForm } from './standings';
import type { Match } from './types';

function match(id: string, utcDate: string, competition: Match['competition'], status: Match['status'], venue: 'H' | 'A', homeScore: number | null, awayScore: number | null): Match {
  return {
    id, utcDate, status, competition, venue,
    home: { name: 'Manchester United FC' }, away: { name: 'Opponent' },
    score: { fullTime: { home: homeScore, away: awayScore }, display: { home: homeScore, away: awayScore } },
    sources: { fd: 1 },
  };
}

describe('recentForm', () => {
  it('maps a win, draw, and loss correctly from MU\'s perspective (home and away)', () => {
    const matches = [
      match('a', '2026-08-01T00:00:00Z', 'PL', 'FINISHED', 'H', 2, 0), // MU won at home
      match('b', '2026-08-08T00:00:00Z', 'PL', 'FINISHED', 'A', 1, 1), // MU drew away
      match('c', '2026-08-15T00:00:00Z', 'PL', 'FINISHED', 'H', 0, 1), // MU lost at home
    ];
    expect(recentForm(matches, 'PL')).toEqual(['W', 'D', 'L']);
  });

  it('takes only the last N finished matches, oldest-first within that window', () => {
    const matches = Array.from({ length: 7 }, (_, i) =>
      match(`m${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'PL', 'FINISHED', 'H', i, 0),
    );
    expect(recentForm(matches, 'PL', 5)).toHaveLength(5);
  });

  it('ignores matches from other competitions and matches that have not finished', () => {
    const matches = [
      match('a', '2026-08-01T00:00:00Z', 'PL', 'FINISHED', 'H', 1, 0),
      match('b', '2026-08-08T00:00:00Z', 'CL', 'FINISHED', 'H', 1, 0),
      match('c', '2026-08-15T00:00:00Z', 'PL', 'SCHEDULED', 'H', null, null),
    ];
    expect(recentForm(matches, 'PL')).toEqual(['W']);
  });

  it('returns an empty array when there are no finished matches in this competition', () => {
    expect(recentForm([], 'PL')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/standings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/standings.ts`:

```ts
import type { CompetitionId, Match } from './types';

// Football convention: oldest of the window first, most recent last (reads left-to-right
// as "how they've been trending", ending on "right now").
export function recentForm(matches: Match[], competition: CompetitionId, limit = 5): ('W' | 'D' | 'L')[] {
  const finished = matches
    .filter(m => m.competition === competition && m.status === 'FINISHED')
    .slice()
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, limit);

  return finished
    .map((m): 'W' | 'D' | 'L' => {
      const muScore = m.venue === 'H' ? m.score.display.home : m.score.display.away;
      const oppScore = m.venue === 'H' ? m.score.display.away : m.score.display.home;
      if (muScore === null || oppScore === null || muScore === oppScore) return 'D';
      return muScore > oppScore ? 'W' : 'L';
    })
    .reverse();
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run lib/standings.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add lib/standings.ts lib/standings.test.ts
git commit -m "feat: add recentForm() — MU's own last-N results from already-merged matches"
```

---

### Task 9: Standings page — table, MU row, Form dots, mobile card list

**Files:**
- Modify: `app/standings/page.tsx`
- Create: `app/standings/page.module.css`
- Modify: `app/standings/page.test.tsx`

**Interfaces:**
- Consumes: `PageHeading` (Task 6), `displayTeamName` (Task 2), `recentForm` (Task 8), `CupRun` (existing, restyled in Task 7).
- Produces: nothing new consumed elsewhere.

**Duplicate-selector fix (spec 7a) status:** already done in Task 4 — `NavFilterPills` now returns `null` on `/standings`, so this task doesn't touch `app/layout.tsx` or the Context.

**Dual-render note:** both the desktop `<table>` and the mobile card-`<ul>` render in the same JSX tree at all times, visibility toggled by a `640px` CSS media query (same reasoning as Task 3's pills: no viewport-detection hook, no hydration risk). This means any team name in the fetched standings appears **twice** in the DOM during tests — Step 5 below updates the pre-existing test to use `getAllByText` instead of `getByText` for that reason.

- [ ] **Step 1: Confirm current tests pass before changing anything**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: PASS — 2 tests (existing baseline).

- [ ] **Step 2: Write the failing test for the "Red Devils" row**

Replace `app/standings/page.test.tsx` in full:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandingsPage from './page';

afterEach(() => vi.unstubAllGlobals());

function standingsRow(position: number, teamName: string) {
  return { position, team: { name: teamName }, playedGames: 14, won: 0, draw: 0, lost: 0, points: 0, goalDifference: 0 };
}

describe('StandingsPage', () => {
  it('loads the PL table by default', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [standingsRow(1, 'AFC Bournemouth')] }) });
      }
      return Promise.resolve({ json: async () => ({ season: '2026-27', matches: [], meta: { sources: { fd: true, espn: true } } }) });
    }));

    render(<StandingsPage />);
    // getAllByText, not getByText: the same row renders once in the desktop table and
    // once in the mobile card list (both always in the DOM, toggled by CSS media query).
    await waitFor(() => expect(screen.getAllByText('AFC Bournemouth').length).toBeGreaterThan(0));
  });

  it('shows Manchester United as "Red Devils" with its own recent form', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/standings')) {
        return Promise.resolve({ json: async () => ({ standings: [standingsRow(1, 'Arsenal FC'), standingsRow(2, 'Manchester United FC')] }) });
      }
      return Promise.resolve({
        json: async () => ({
          season: '2026-27',
          matches: [{
            id: 'm1', utcDate: '2026-08-01T15:00:00Z', status: 'FINISHED', competition: 'PL',
            home: { name: 'Manchester United FC' }, away: { name: 'Arsenal FC' }, venue: 'H',
            score: { fullTime: { home: 2, away: 0 }, display: { home: 2, away: 0 } },
            sources: { fd: 1 },
          }],
          meta: { sources: { fd: true, espn: true } },
        }),
      });
    }));

    render(<StandingsPage />);
    await waitFor(() => expect(screen.getAllByText('Red Devils').length).toBeGreaterThan(0));
    expect(screen.queryByText('Manchester United FC')).not.toBeInTheDocument();
    expect(screen.getAllByText('W').length).toBeGreaterThan(0);
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

- [ ] **Step 3: Run and see it fail**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: FAIL — the new "Red Devils" test fails (page still renders "Manchester United FC" and has no Form column); the first test also fails at this point since `getAllByText` on the current single-render page still technically passes, but confirm by running before Step 4's implementation lands.

- [ ] **Step 4: Implement**

Replace `app/standings/page.tsx` in full:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { Match, MatchesResponse, StandingRow } from '@/lib/types';
import { CupRun } from '@/components/CupRun';
import { PageHeading } from '@/components/PageHeading';
import { displayTeamName } from '@/lib/normalize';
import { recentForm } from '@/lib/standings';
import styles from './page.module.css';

type Tab = 'PL' | 'CL' | 'FA' | 'EFL';

function FormDots({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return <span className={styles.formPlaceholder}>—</span>;
  return (
    <span className={styles.formDots}>
      {form.map((r, i) => (
        <span key={i} className={`${styles.dot} ${r === 'W' ? styles.dotW : r === 'D' ? styles.dotD : styles.dotL}`}>{r}</span>
      ))}
    </span>
  );
}

export default function StandingsPage() {
  // [React] This tab lives only on this page. Reusing CompetitionFilterContext here
  // would couple two unrelated UI concerns for no benefit — local useState is the right
  // tool when a piece of state doesn't need to escape the component that owns it.
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

  // Only MU's own finished matches produce real form data (the app has no other club's
  // match history) — used on MU's row only; every other row shows a placeholder.
  const muForm = (tab === 'PL' || tab === 'CL') ? recentForm(matches, tab, 5) : [];

  return (
    <main className={styles.main}>
      <PageHeading title="Standings" />
      <div role="tablist" className={styles.tabs}>
        {(['PL', 'CL', 'FA', 'EFL'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={styles.tab}>{t}</button>
        ))}
      </div>
      {(tab === 'PL' || tab === 'CL') && (
        standings ? (
          <>
            <table className={styles.tableDesktop}>
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>P</th><th>Form</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(row => {
                  const isMu = displayTeamName(row.team.name) === 'Red Devils';
                  return (
                    <tr key={row.team.name} className={isMu ? styles.muRow : undefined}>
                      <td>{row.position}</td>
                      <td className={isMu ? styles.muName : undefined}>{displayTeamName(row.team.name)}</td>
                      <td>{row.playedGames}</td>
                      <td>{isMu ? <FormDots form={muForm} /> : <span className={styles.formPlaceholder}>—</span>}</td>
                      <td>{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className={styles.listMobile}>
              {standings.map(row => {
                const isMu = displayTeamName(row.team.name) === 'Red Devils';
                return (
                  <li key={row.team.name} className={isMu ? styles.muRow : undefined}>
                    <span className={styles.position}>{row.position}</span>
                    <span className={styles.rowMain}>
                      <span className={isMu ? styles.muName : undefined}>{displayTeamName(row.team.name)}</span>
                      {isMu ? <FormDots form={muForm} /> : <span className={styles.formPlaceholder}>—</span>}
                    </span>
                    <span className={styles.rowStats}>
                      <span className={styles.points}>{row.points}</span>
                      <span className={styles.played}>{row.playedGames} played</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : <p>Loading...</p>
      )}
      {(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}
    </main>
  );
}
```

Create `app/standings/page.module.css`:

```css
.main {
  padding: 1.5rem;
}

.tabs {
  display: flex;
  gap: 6px;
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

.tableDesktop {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.tableDesktop th {
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(237, 230, 214, 0.55);
  text-align: left;
  padding: 5px 4px;
  border-bottom: 1px solid rgba(201, 162, 39, 0.25);
}

.tableDesktop td {
  padding: 7px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.muRow {
  background: rgba(218, 41, 28, 0.1);
  border-left: 3px solid var(--mu-red);
}

.muName {
  font-weight: 700;
  color: var(--mu-gold);
}

.formDots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
}

.dotW { background: var(--mu-green); color: #0d0d0d; }
.dotD { background: var(--mu-gold); color: #0d0d0d; }
.dotL { background: var(--mu-red); color: #fff; }

.formPlaceholder {
  color: rgba(237, 230, 214, 0.3);
}

.listMobile {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.listMobile li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 3px;
  margin-bottom: 6px;
}

.position {
  font-family: var(--font-mono);
  width: 20px;
  flex-shrink: 0;
}

.rowMain {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rowStats {
  text-align: right;
  flex-shrink: 0;
}

.points {
  display: block;
  font-family: var(--font-mono);
  color: var(--mu-gold);
  font-weight: 700;
  font-size: 15px;
}

.played {
  display: block;
  font-size: 9px;
  opacity: 0.5;
}

@media (max-width: 640px) {
  .tableDesktop {
    display: none;
  }
  .listMobile {
    display: block;
  }
}
```

- [ ] **Step 5: Run and see it pass**

Run: `npx vitest run app/standings/page.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 6: Full suite, typecheck, build, commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

```bash
git add app/standings/page.tsx app/standings/page.module.css app/standings/page.test.tsx
git commit -m "feat: restyle Standings — Red Devils row, Form dots, mobile card list"
```

---

### Task 10: Match detail score header

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/match/[id]/page.tsx`
- Create: `app/match/[id]/page.module.css`
- Modify: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `displayTeamName` (Task 2).
- Produces: `EspnDetail`'s `competitors` items now carry `score?: string` and `team?: { id?: string; displayName?: string }` (widened from `team?: { id?: string }`) — any future task reading `EspnDetail` can rely on these fields existing.

**Real addition, not previously in scope (spec section 8):** this page currently has no score header at all. Verified against real ESPN data during this session's manual QA: `header.competitions[0].competitors[].score` and `.team.displayName` both exist on the raw API response — `EspnDetail`'s TypeScript type just didn't declare them yet (Task 14 of the original plan only typed what was consumed at the time).

- [ ] **Step 1: Widen the `EspnDetail` type**

In `lib/types.ts`, find the `EspnDetail` interface:

```ts
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

Replace the `competitors` line with:

```ts
      competitors?: Array<{ homeAway: 'home' | 'away'; team?: { id?: string; displayName?: string }; score?: string }>;
```

- [ ] **Step 2: Write the failing test**

In `app/match/[id]/page.test.tsx`, update the `'renders scorers and lineups once the detail loads'` test's fixture — replace:

```js
            competitors: [{ homeAway: 'home', team: { id: '331' } }, { homeAway: 'away', team: { id: '360' } }],
```

with:

```js
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '1' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '2' },
            ],
```

Then extend the same test's assertions (after the existing `expect(screen.getByTestId('formation-pitch')).toBeInTheDocument();` line):

```tsx
    expect(screen.getByText('Red Devils')).toBeInTheDocument();
    expect(screen.getByText('Brighton & Hove Albion')).toBeInTheDocument();
    expect(screen.getByText(/1 – 2/)).toBeInTheDocument();
    expect(screen.getByText('Full Time')).toBeInTheDocument();
```

- [ ] **Step 3: Run and see it fail**

Run: `npx vitest run "app/match/[id]/page.test.tsx"`
Expected: FAIL — no "Red Devils" text, no score header, no status text on the page yet.

- [ ] **Step 4: Implement**

Replace `app/match/[id]/page.tsx` in full:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePolling } from '@/hooks/usePolling';
import { FormationPitch } from '@/components/FormationPitch';
import { extractScorers } from '@/lib/merge';
import { displayTeamName } from '@/lib/normalize';
import type { EspnDetail } from '@/lib/types';
import styles from './page.module.css';

async function fetchDetail(espnId: string, slug: string): Promise<EspnDetail> {
  const res = await fetch(`/api/match/${espnId}?slug=${slug}`);
  if (!res.ok) throw new Error('Failed to load match detail');
  return res.json();
}

// [React] Pure formatter, tested through the page's own rendered output — same pattern
// as MatchCard's local statusLabel(), not extracted to lib/ since it's specific to this
// one page's header and not reused elsewhere.
function matchStatusText(detail: EspnDetail): string {
  const status = detail.header?.competitions?.[0]?.status;
  const state = status?.type?.state;
  if (state === 'post') return 'Full Time';
  if (state === 'in') {
    return status?.type?.name === 'STATUS_HALFTIME' ? 'Half Time' : `Live · ${status?.displayClock ?? ''}`;
  }
  return 'Kickoff soon';
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
  const homeComp = headerComp?.competitors?.find(c => c.homeAway === 'home');
  const awayComp = headerComp?.competitors?.find(c => c.homeAway === 'away');
  const homeTeamEspnId = homeComp?.team?.id || '';
  const scorers = extractScorers(data, homeTeamEspnId);
  const rosters = data.rosters || [];
  const home = rosters.find(r => r.homeAway === 'home');
  const away = rosters.find(r => r.homeAway === 'away');

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Match #{params.id}</h1>
      <div className={styles.scoreHeader}>
        <span className={styles.teamName}>{displayTeamName(homeComp?.team?.displayName || '')}</span>
        <span className={styles.score}>{homeComp?.score ?? '-'} – {awayComp?.score ?? '-'}</span>
        <span className={styles.teamName}>{displayTeamName(awayComp?.team?.displayName || '')}</span>
      </div>
      <p className={styles.status}>{matchStatusText(data)}</p>
      <FormationPitch homeRoster={home} awayRoster={away} />
      <section className={styles.scorers}>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
    </main>
  );
}
```

Create `app/match/[id]/page.module.css`:

```css
.main {
  padding: 1.5rem;
}

.title {
  font-size: 22px;
}

.scoreHeader {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--font-body);
  font-weight: 700;
}

.teamName {
  color: var(--mu-white);
}

.score {
  font-family: var(--font-mono);
  color: var(--mu-gold);
  font-size: 18px;
}

.status {
  font-family: var(--font-mono);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
  margin: 2px 0 16px;
}

.scorers {
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(201, 162, 39, 0.3);
  border-radius: 3px;
}
```

- [ ] **Step 5: Run and see it pass**

Run: `npx vitest run "app/match/[id]/page.test.tsx"`
Expected: PASS — 3 tests.

- [ ] **Step 6: Full suite, typecheck, build, commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

```bash
git add lib/types.ts "app/match/[id]/page.tsx" "app/match/[id]/page.module.css" "app/match/[id]/page.test.tsx"
git commit -m "feat: add match detail score header (Red Devils N – N Opponent, status line)"
```

---

### Task 11: Formation pitch restyle

**Files:**
- Modify: `components/FormationPitch.tsx`
- Create: `components/FormationPitch.module.css`
- Modify: `components/FormationPitch.test.tsx`

**Interfaces:**
- Consumes: `displayTeamName`, `isManUtd` (Task 2 / existing `lib/normalize.ts`), `buildFormationRows` (existing, `lib/formation.ts` — untouched).
- Produces: nothing new consumed elsewhere.

**Behavior change flagged:** the current implementation joins every player in a row into one comma-separated string (`row.map(p => p.athlete?.displayName).join(', ')`) — a Task 24 placeholder, not the final visual. This task renders each player as its own node (circle + name), matching the approved mockup. Step 2 adds a multi-player test since the existing single-player fixture can't tell the two rendering approaches apart.

- [ ] **Step 1: Confirm current tests pass before changing anything**

Run: `npx vitest run components/FormationPitch.test.tsx`
Expected: PASS — 3 tests (existing baseline).

- [ ] **Step 2: Write the failing tests**

Add to `components/FormationPitch.test.tsx` (inside the existing `describe` block, after the `'renders the home roster player'` test):

```tsx
  it('renders every player in a multi-player row, not just the first', () => {
    const multiPlayerRoster: EspnRoster = {
      homeAway: 'home',
      team: { displayName: 'Manchester United' },
      formation: '4-3-3',
      roster: [
        { starter: true, formationPlace: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Onana' } },
        { starter: true, formationPlace: '2', position: { abbreviation: 'RB' }, athlete: { displayName: 'Dalot' } },
        { starter: true, formationPlace: '3', position: { abbreviation: 'LB' }, athlete: { displayName: 'Shaw' } },
      ],
    };
    render(<FormationPitch homeRoster={multiPlayerRoster} />);
    expect(screen.getByText('Onana')).toBeInTheDocument();
    expect(screen.getByText('Dalot')).toBeInTheDocument();
    expect(screen.getByText('Shaw')).toBeInTheDocument();
  });

  it('shows "Red Devils" as the team label wherever MU is playing — home or away', () => {
    const awayMuRoster: EspnRoster = { homeAway: 'away', team: { displayName: 'Manchester United' }, formation: '4-3-3', roster: [] };
    const homeOpponentRoster: EspnRoster = { homeAway: 'home', team: { displayName: 'Brighton & Hove Albion' }, formation: '4-3-3', roster: [] };
    render(<FormationPitch homeRoster={homeOpponentRoster} awayRoster={awayMuRoster} />);
    expect(screen.getByText('Red Devils')).toBeInTheDocument();
    expect(screen.getByText('Brighton & Hove Albion')).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run and see it fail**

Run: `npx vitest run components/FormationPitch.test.tsx`
Expected: FAIL — the second new test fails (no team labels rendered at all currently); the first new test may already pass by coincidence (the join produces the right substrings) but will be exercised properly once Step 4 lands.

- [ ] **Step 4: Implement**

Replace `components/FormationPitch.tsx` in full:

```tsx
'use client';
import { useMemo } from 'react';
import { buildFormationRows } from '@/lib/formation';
import { displayTeamName, isManUtd } from '@/lib/normalize';
import type { EspnRoster } from '@/lib/types';
import styles from './FormationPitch.module.css';

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

  const homeIsMu = isManUtd(homeRoster?.team?.displayName || '');
  const awayIsMu = isManUtd(awayRoster?.team?.displayName || '');

  return (
    <div data-testid="formation-pitch" className={styles.pitch}>
      <div className={styles.pitchLines} />
      <div className={styles.teamLabel}>{displayTeamName(awayRoster?.team?.displayName || '')}</div>
      <div data-testid="away-rows">
        {awayRows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((p, j) => (
              <span key={j} className={styles.node}>
                <span className={`${styles.circle} ${awayIsMu ? styles.muCircle : ''}`}>{p.formationPlace}</span>
                <span className={styles.name}>{p.athlete?.displayName}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.midline}>
        <div className={styles.centerCircle} />
      </div>
      <div data-testid="home-rows">
        {homeRows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((p, j) => (
              <span key={j} className={styles.node}>
                <span className={`${styles.circle} ${homeIsMu ? styles.muCircle : ''}`}>{p.formationPlace}</span>
                <span className={styles.name}>{p.athlete?.displayName}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.teamLabel}>{displayTeamName(homeRoster?.team?.displayName || '')}</div>
    </div>
  );
}
```

Create `components/FormationPitch.module.css`:

```css
.pitch {
  position: relative;
  background: linear-gradient(
    180deg,
    #1a4020 0%, #1d4a24 12.5%, #1a4020 12.5%, #1a4020 25%,
    #1d4a24 25%, #1d4a24 37.5%, #1a4020 37.5%, #1a4020 50%,
    #1d4a24 50%, #1d4a24 62.5%, #1a4020 62.5%, #1a4020 75%,
    #1d4a24 75%, #1d4a24 87.5%, #1a4020 87.5%
  );
  border: 1px solid rgba(201, 162, 39, 0.3);
  border-radius: 6px;
  padding: 10px 8px;
}

.pitchLines {
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(237, 230, 214, 0.25);
  border-radius: 2px;
  pointer-events: none;
}

.teamLabel {
  text-align: center;
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(237, 230, 214, 0.65);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  padding: 6px 0;
}

.row {
  display: flex;
  justify-content: space-evenly;
  margin: 8px 0;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 44px;
}

.circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(237, 230, 214, 0.4);
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--mu-white);
}

.muCircle {
  background: rgba(218, 41, 28, 0.25);
  border-color: var(--mu-red);
}

.name {
  font-size: 8.5px;
  color: rgba(237, 230, 214, 0.85);
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  font-weight: 600;
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.midline {
  border-top: 1.5px solid rgba(237, 230, 214, 0.3);
  border-bottom: 1.5px solid rgba(237, 230, 214, 0.3);
  height: 26px;
  margin: 4px 0;
  position: relative;
}

.centerCircle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 1.5px solid rgba(237, 230, 214, 0.3);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

- [ ] **Step 5: Run and see it pass**

Run: `npx vitest run components/FormationPitch.test.tsx`
Expected: PASS — 5 tests (3 existing + 2 new).

- [ ] **Step 6: Full suite, typecheck, build, commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

```bash
git add components/FormationPitch.tsx components/FormationPitch.module.css components/FormationPitch.test.tsx
git commit -m "feat: restyle FormationPitch — per-player nodes, MU-side highlighting, team labels"
```

---

### Task 12: Full responsive/visual QA pass + final verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: every task above.
- Produces: nothing — this is the closing gate before the branch is considered done.

- [ ] **Step 1: Full suite, typecheck, build one last time**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — all tests across the whole codebase, clean typecheck, clean production build.

- [ ] **Step 2: Start the dev server**

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>&1
npm run dev > /tmp/mu-dev-server.log 2>&1 &
disown
i=0; while [ $i -lt 30 ]; do curl -sf http://localhost:3000 >/dev/null && echo "SERVER UP" && break; sleep 1; i=$((i+1)); done
```

Expected: `SERVER UP` printed within a few seconds.

- [ ] **Step 3: Screenshot every page at desktop width (1280px)**

Write a driver script (adjust the Chromium `executablePath` to whatever Playwright resolves locally — run `npx playwright install chromium` first if `~/Library/Caches/ms-playwright` has no `chromium-*` directory, then `find ~/Library/Caches/ms-playwright -iname "*.app" -path "*MacOS*"` to find the exact binary path for your OS):

```js
// scratch script, e.g. /tmp/qa-desktop.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '<resolved chromium path>' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

for (const url of ['/', '/schedule', '/standings']) {
  await page.goto(`http://localhost:3000${url}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `/tmp/qa-desktop-${url.replace(/\//g, '_') || 'today'}.png`, fullPage: true });
}

// Standings FA tab
await page.getByRole('tab', { name: 'FA', exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/qa-desktop-standings-fa.png', fullPage: true });

console.log('console/page errors:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
```

Run: `node /tmp/qa-desktop.mjs`
Expected: no console/page errors printed. Read each screenshot and confirm: dark retro theme applied, dashed match cards, Red Devils row in Standings, Form dots visible, tabs styled.

- [ ] **Step 4: Screenshot every page at mobile width (375px)**

Same script pattern, `viewport: { width: 375, height: 800 }`, screenshots to `/tmp/qa-mobile-*.png`. Confirm specifically: nav pills wrap and show short labels (PL/UCL/Carabao) below 640px, and the Standings table is replaced by the mobile card list (no horizontal overflow).

- [ ] **Step 5: Click into a match detail page from Schedule**

Extend the driver (or a second script) to navigate to `/schedule`, click a `FINISHED` match's link (if one exists in the live data at test time — per Task 27 of the original plan, this may need to be repeated once real finished matches exist in-season), screenshot the result, and confirm the score header (`Red Devils N – N Opponent`) and restyled formation pitch render without console errors.

- [ ] **Step 6: Stop the dev server**

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>&1
```

- [ ] **Step 7: Final commit (if any fixes were needed during QA)**

If Steps 3–5 surfaced any visual bug, fix it in the relevant task's files, re-run that task's own test suite, then:

```bash
git add -A
git commit -m "fix: address visual QA findings from the responsive pass"
```

If no fixes were needed, skip this step — Task 11's commit is the last one.

---

## Self-review

**Spec coverage** (against `docs/superpowers/specs/2026-07-18-ui-visual-identity-design.md`):
- Section 2 (tokens): Task 1.
- Section 3 (`displayTeamName`): Task 2.
- Section 4 (page headings): Task 6.
- Section 5 (match card + LiveBadge): Task 5.
- Section 6 (pills): Task 3.
- Section 7a (duplicate selector): Task 4. 7b/7c (table + dots): Task 9. 7d (Cup Run, round numbers scoped out): Task 7.
- Section 8 (match detail header): Task 10.
- Section 9 (formation pitch): Task 11.
- Section 10 (responsive — pills 10a: Task 3; table 10b: Task 9; 10c confirmed via Task 12's screenshots).
- Section 11 (testing strategy): every item has a corresponding TDD step above.
- Section 12 (out of scope): no task builds cup round numbers, no task adds a new external "form" data source, no task touches `lib/merge.ts`/`lib/fd.ts`/`lib/espn.ts`/`usePolling`/Context architecture — confirmed by grep-checking this plan's file list against those paths (none appear as Modify/Create targets).

**Placeholder scan:** no TBD/TODO. Task 12 Step 3's Chromium path is marked "adjust to your local resolution" rather than a fixed path, since this session's actual resolved path (`~/Library/Caches/ms-playwright/chromium-1228/...`) is machine/version-specific — the step includes the exact `find` command to resolve it fresh, not a placeholder to fill in blindly.

**Type consistency:** `CompetitionMapping.navShortLabel` (Task 3) is read only by `CompetitionFilterPills.tsx` in this plan — no other task references it, no mismatch risk. `EspnDetail`'s widened `competitors` shape (Task 10) is consumed only within `app/match/[id]/page.tsx`; `extractScorers` (`lib/merge.ts`) already destructures `competitors` more narrowly and isn't affected by the widening (TypeScript structural typing — a wider optional-field type is still assignable). `displayTeamName`/`recentForm` signatures match between their defining task (2, 8) and every consuming task (9, 10, 11).

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-07-18-ui-visual-identity-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
