# MU Live Tracker — Visual Identity Redesign

> Design spec for the UI polish pass. Product/data logic (BFF, merge, hooks, Context)
> from the original 28-task plan is untouched — this only adds CSS Modules, small
> presentational wiring, and one display-layer text utility.

## 1. Background

The original plan (`2026-07-16-mu-live-tracker-plan.md`) intentionally deferred visual
detail — design spec section 7 says *"Chi tiết visual cụ thể chốt cùng user khi làm
layout"* — and no task in the 28-task plan covers layout/spacing/card design. The result:
functionally complete, visually bare (only `app/globals.css` tokens + `MatchCard`'s one
CSS Module exist; every other component renders unstyled HTML).

This spec closes that gap through a 2026-07-18 brainstorm session, using the visual
companion. Direction confirmed: **own MU identity, not a WC-2026-live-tracker reskin** —
matchday-programme heritage feel, deliberately retro.

## 2. Design tokens (`app/globals.css`)

Replaces the existing 5-token set. Rationale for each change is inline.

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --mu-red: #DA291C;
  --mu-red-dark: #9A1F14;
  --mu-black: #0d0d0d;        /* page background (was #111111) */
  --mu-surface: #161310;      /* card/panel background — distinct from page bg, warm */
  --mu-gold: #C9A227;         /* primary accent, aged gold (was bright #FFD700) */
  --mu-gold-bright: #FFD700;  /* reserved: Fergie Time pulse only — a deliberately
                                  louder color for a deliberately urgent moment */
  --mu-green: #3fae5c;        /* W/D/L win */
  --mu-white: #EDE6D6;        /* parchment/ivory text (was flat #F5F5F5) */
  --font-heading: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

`body` switches from `system-ui` to `var(--font-body)`. `h1,h2,h3` keep
`var(--font-heading)` but the value changes underneath them (Playfair Display, weight
900 for `h1`/page titles per the mockups).

Fergie Time keeps its existing `fergie-pulse` keyframe (opacity 1→0.4, 1s) — mechanic is
fine, only the badge markup/color around it changes (section 5).

## 3. Shared: `displayTeamName()` (`lib/normalize.ts`)

New pure function, colocated with `isManUtd` (which it wraps):

```ts
export function displayTeamName(name: string): string {
  return isManUtd(name) ? 'Red Devils' : name;
}
```

Display-layer only — never touches stored data, API responses, or `Match`/`StandingRow`
objects themselves. Applied at the 3 places MU's own name is shown as one entry among
others (never in `MatchCard`, which already shows "vs {opponent}" from MU's own
perspective and never names MU explicitly):

- `app/standings/page.tsx` — table row team-name cell
- `components/FormationPitch.tsx` — team label above/below the pitch
- `app/match/[id]/page.tsx` — new score header (section 8)

Test: `lib/normalize.test.ts` gets 2 new cases (`displayTeamName('Manchester United FC')
→ 'Red Devils'`, `displayTeamName('Arsenal FC') → 'Arsenal FC'`).

## 4. Page headings (Today / Schedule / Standings)

Shared treatment, confirmed in the brainstorm's hero mockup — applied inline in each
page component (`<h1>` already gets `var(--font-heading)` globally; this adds the rule
line + subtitle underneath it, not a separate component):

```
<h1>Today</h1>
<div className={styles.rule} />          {/* 1px, linear-gradient(90deg, var(--mu-gold), transparent), width 60-70% */}
<p className={styles.kicker}>Matchday Programme · {date}</p>
```

**Change from the mockup:** dropped the "No. 14" issue number. It was decorative
placeholder text with no backing meaning (unlike a real programme's issue number, this
tracker has no concept of one) — inventing a fake incrementing number would be
fabricated data, the same category of problem as section 7d's round numbers. The kicker
line keeps "Matchday Programme" (the retro flavor) plus the real current date, dropped
the invented part.

## 5. Match card (`components/MatchCard.tsx` + `.module.css`)

Ticket-stub treatment: dashed border, corner-stamp live badge, mono font for time/score.

- Card: `background: var(--mu-surface)`, `border: 1.5px dashed`, `border-radius: 3px`.
  Border color varies by state (kept in the module, not a shared token — these are
  one-off state colors, not reusable design constants):
  - Live: `rgba(201,162,39,.5)` (gold-tinted, stands out)
  - Finished (clickable): `rgba(255,255,255,.14)`
  - Scheduled (not clickable): `rgba(255,255,255,.08)` + the card gets `opacity: .75`
    (per the confirmed mockup — visually distinguishes "no result yet" without relying on
    text alone)
- Score: `var(--font-mono)`, `var(--mu-gold)` when there's a real score, dimmed
  (`opacity: .4`) `– : –` placeholder otherwise.
- **`LiveBadge` gets wired up** (currently dead code — see finding below): `MatchCard`
  renders `<LiveBadge match={match} />` positioned absolute, top-left, overlapping the
  card's top border (the "stamp" look from the mockup), for `IN_PLAY`/`PAUSED` only.
  `statusLabel()` keeps handling `FINISHED`/`SCHEDULED`/`POSTPONED` text as today.

**Finding carried into this spec:** `components/LiveBadge.tsx` has full logic and test
coverage (`isFergieTime`, HT/live/Fergie text) but `MatchCard` only ever imported
`isFergieTime` from it, never rendered the `<LiveBadge>` component — it re-implemented
the label as plain text instead. Wiring it up is a small integration fix, not new logic;
`LiveBadge`'s existing behavior/tests are untouched, only its CSS classes
(`badge-live`/`badge-ht`/`badge-fergie` in `globals.css`) get restyled to the stamp look:
small red/mono background chip, uppercase, `border-radius: 1px`. Fergie Time uses
`--mu-gold-bright` + `fergie-pulse` (unchanged mechanic); live/HT use `--mu-red`/plain.

## 6. Competition filter pills (`components/CompetitionFilterPills.tsx` — CSS only)

New `.module.css`. Pill/tag shape: `border: 1px solid`, `border-radius: 2px`, uppercase,
`letter-spacing: .08em`, `font-size: 10.5px`. Selected state: red border +
`background: rgba(218,41,28,.15)`. Unselected: gold border + gold text
(`var(--mu-gold)`). No JSX/behavior change — this component is already a pure controlled
component (Task 18); only its rendered `<button>`s gain a `className`.

## 7. Standings page (`app/standings/page.tsx`)

### 7a. Duplicate competition selector (bug found during this session's manual QA)

The page currently renders **two** competition selectors at once: the shared nav pills
(`NavFilterPills`, driven by `CompetitionFilterContext` — All/PL/UEFA/FA/Carabao/Friendly)
*and* its own local PL/CL/FA/EFL tabs directly below. Confirmed live via browser
screenshot. Both are legitimate (the nav pills exist for Today/Schedule; Standings'
local tabs are Task 26's deliberate "local state, not Context" teaching example, and
cover a different, more precise set — no "All"/"Friendly" makes sense for a standings
table) — but stacked on one page they read as redundant.

**Fix:** hide the shared nav pills specifically on `/standings`. `components/
NavFilterPills.tsx` gains `usePathname()` (it's already a Client Component) and returns
`null` when the path starts with `/standings`. `app/layout.tsx` stays untouched — no
Context/architecture change, purely a presentational conditional in the one component
responsible for rendering the pills. `CompetitionFilterContext` (Task 22) and Standings'
own `useState` tab (Task 26) are both unchanged.

Test: new case in `components/NavFilterPills.test.tsx` (mock `usePathname` to return
`/standings` → renders nothing; any other path → renders as today).

### 7b. Table

- Columns: `#`, `Team`, `P` (playedGames), `Form`, `Pts`. `Form` and column reordering
  vs. the current `[position, team, playedGames, points]` render is a real (small)
  layout change — `Form` is derived from `StandingRow.won/draw/lost`, not a stored
  "form string", so it needs a small helper (section 7c).
- MU's row: `background: rgba(218,41,28,.1)`, `border-left: 3px solid var(--mu-red)`,
  team name via `displayTeamName()` → **"Red Devils"**, bold, `color: var(--mu-gold)`.
- Header row: `var(--font-mono)`, uppercase, `letter-spacing: .08em`,
  `color: rgba(237,230,214,.55)` (dimmed parchment).

### 7c. Form (W/D/L) dots

Confirmed style **C**: solid circular dot, white/black text for contrast, `18px`
diameter, `4px` gap between dots (the "ngộp thở"/cramped feedback — no gap at all in the
first pass — is what drove this). `background: var(--mu-green)` (W) /
`var(--mu-gold)` (D) / `var(--mu-red)` (L); text color `#0d0d0d` on green/gold,
`#fff` on red (contrast).

**New, not previously in scope:** `StandingRow` has `won`/`draw`/`lost` counts but no
per-match-result sequence — football-data's standings endpoint doesn't return a "last 5
results" string. Rendering *actual* W/D/L form dots (not placeholder ones) requires
either (a) a new field from a different football-data endpoint, or (b) deriving it from
the merged match list (filter this competition's finished MU matches, sort by date,
take last 5, map result). **(b)** is buildable from data already in hand
(`MatchesResponse.matches`) with no new API calls — a pure function
`lib/standings.ts:recentForm(matches, competition, limit=5): ('W'|'D'|'L')[]`, tested the
same way as the rest of `lib/`. This is the one place this spec adds real (small) derived
logic rather than pure styling — called out explicitly since it's not "just CSS."

### 7d. Cup Run tab (FA/EFL)

Same dashed-card treatment as Schedule's list (section 5) — `CupRun.tsx` gains a
`.module.css` reusing the same visual language, no behavior change.

**Scoped out:** the brainstorm mockup showed an abbreviated round label ("R3"). `Match`
has no round/matchday field, and football-data/ESPN's schedule responses (already wired
into `lib/types.ts`) don't carry one either — adding it means new plumbing through
`FdMatch`/`EspnScheduleEvent`/`mergeMatches`, well beyond a UI pass. **Not built.**
`CupRun` keeps showing date + opponent + score, restyled only.

## 8. Match detail page (`app/match/[id]/page.tsx`)

**New, not previously in scope:** the page currently has no score header at all —
just `<h1>Match #{id}</h1>`, `FormationPitch`, then Scorers. The mockup's
"Red Devils 2 – 1 Brighton" header is a real addition, built from data already fetched
(`EspnDetail.header.competitions[0].competitors` for names/homeAway,
`computeDisplayScore`-equivalent from the two teams' scores — check what `EspnDetail`
already exposes for score before reaching for a new field). Home/away team names run
through `displayTeamName()`. Status line (`Full Time` / `Live · 63'` / kickoff time)
derived from `header.competitions[0].status`, already available.

Scorers section reuses the same dashed-card (`.module.css` shared with MatchCard/CupRun
where the visual language matches — a shared `card.module.css` or repeated per-component
module is an implementation-time call, not a design decision).

## 9. Formation pitch (`components/FormationPitch.tsx` + `.module.css`)

CSS-drawn pitch (striped green gradient, darker/less saturated than a literal grass
green to sit in the dark retro palette — `#1a4020`/`#1d4a24` per the mockup, not
WC-2026's brighter `#1a5c2a`/`#1d6430`). Center circle + midline via border, no SVG.

Player nodes: `30px` circle, `var(--font-mono)` jersey number, `2px` border.
Red-tinted (`background: rgba(218,41,28,.25)`, `border-color: var(--mu-red)`) for MU's
side, plain (`border-color: rgba(237,230,214,.4)`) for the opponent — side determined by
which of `homeRoster`/`awayRoster` matches `isManUtd()` on `team.displayName`, not by
`homeAway` alone (MU can be away). Team label above/below the pitch via
`displayTeamName()`.

`buildFormationRows`'s row/lateral-sort logic (`lib/formation.ts`) is untouched — this
section is presentational only, consuming its existing output. The lateral-priority fix
already landed this session (`formationPlace` before abbreviation suffix) is a
prerequisite this styling pass depends on being correct, not something it re-verifies.

No-lineup fallback text (`"Lineup not available for this match."`) keeps its current
copy, gets basic spacing/color only.

## 10. Testing strategy

- Pure-CSS changes (MatchCard border/color, pills, table cell styling, pitch gradient):
  no new tests — existing RTL tests assert on text/roles/testids, not computed styles,
  so they keep passing unchanged. Spot-check visually via the `run` skill (dev server +
  headless browser screenshot), not unit tests, per this project's own established
  pattern this session.
- Real behavior/logic additions get real tests, TDD as the rest of this codebase:
  - `displayTeamName()` — `lib/normalize.test.ts`
  - `NavFilterPills` hiding on `/standings` — `components/NavFilterPills.test.tsx`
    (doesn't exist yet; small new file)
  - `recentForm()` — new `lib/standings.test.ts`
  - `MatchCard` rendering `<LiveBadge>` instead of plain-text minute for `IN_PLAY` —
    update `components/MatchCard.test.tsx`'s existing live-state assertions to match
  - Match detail score header — new cases in `app/match/[id]/page.test.tsx`
- Full suite + `npm run typecheck` + `npm run build` (the `useSearchParams`/Suspense
  question from Task 27 is already resolved — route is dynamic, confirmed) after each
  logical group of changes, matching the established milestone-by-milestone rhythm.

## 11. Out of scope

- Responsive/mobile layout — not raised in the brainstorm, not addressed here.
- Real "last 5 form" data beyond what's derivable from already-merged matches (no new
  external data source).
- Cup round numbers (section 7d) — no backing data, not built.
- Any change to `lib/merge.ts`, `lib/fd.ts`, `lib/espn.ts` (beyond the two data-fetching
  fixes already committed earlier this session, which predate and are independent of
  this spec), `usePolling`, or Context/state architecture — this is a presentational
  pass over already-correct data flow.
