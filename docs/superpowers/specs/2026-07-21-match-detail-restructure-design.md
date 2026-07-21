# Match Detail Page — Restructure & Stats Accuracy Fix

> Design spec for reorganizing `app/match/[id]/page.tsx`'s section order/styling to
> match wc-2026-live-tracker's direction (score + scorers always visible, stats as the
> primary detail section), plus fixing two real rounding/display bugs found in
> `extractStats()` while comparing the two projects' stats logic.

## 1. Background

User request: bring the match detail page's layout in line with the sibling project
`wc-2026-live-tracker` — score + scorers "outside" (persistent, not buried below other
sections), and what was that project's scorer-adjacent content becomes the Stats
section. Investigation (reading `wc-2026-live-tracker/render.js`) found:

- That project has no literal tab UI for match detail. Score + scorers render directly
  on the always-visible match card (`renderMatchCard` + `scorersLineHtml`); a
  click-to-expand panel (`renderMatchDetail`) holds Lineup → Stats → Substitutions →
  Shootout, in that order. A code comment there notes stats replaced an older
  scorer/event timeline in that panel — the source of "tab Scorers thành Stats."
- Our `extractStats()` (`lib/merge.ts:214`) already reads the same 10 ESPN boxscore
  fields as wc-2026's `STAT_DEFS`, correctly, with passing tests. Field mapping is not
  the issue.
- Two real bugs exist in the percentage stats, independent of any ESPN-vs-FIFA data
  source disagreement (which is not fixable in our code): Possession and Pass Accuracy
  round home% and away% **independently**, so the pair can fail to sum to 100 (e.g.
  49.5/50.5 → 50%/51%). And when the underlying total is 0 (no boxscore data yet),
  Pass Accuracy displays `0%` instead of `–`, misleadingly implying zero completed
  passes rather than "no data yet."

Confirmed with the user: fix the two bugs above; do not chase ESPN-vs-FIFA numeric
disagreement (different data sources computing stats differently, out of this
project's control). Venue/location display is explicitly out of scope — wc-2026 sources
it from a separate hardcoded venue table we don't have, and it wasn't part of the ask.

## 2. Section order (`app/match/[id]/page.tsx`)

Current render order: Score header → Status → Lineup (`<details>`) → **Scorers**
(boxed section) → Shootout → Stats → Substitutions (`<details>`).

New order: Score header → Status → **Scorers** (moved up, no box — see §3) → Lineup
(`<details>`) → Stats → Substitutions (`<details>`) → Shootout.

Rationale: Scorers moves next to the score/status it's part of, ahead of the
collapsible Lineup — matching wc-2026's "always visible, not buried" placement. The
remaining sections (Lineup, Stats, Subs, Shootout) keep wc-2026's exact order, with
Shootout last since it's the resolution of the score, not a mid-match stat.

No conditional-rendering logic changes — each section keeps its existing guard
(`stats.length > 0`, `subCount > 0`, `shootout &&`); only their position in the JSX
moves.

## 3. Scorers visual treatment (`page.module.css`)

Remove the `.scorers` class's card chrome (`background: var(--mu-surface)`,
`border: 1.5px dashed ...`, `border-radius`) — see current `page.module.css:133-139`.
Keep `margin-top` (reduced to sit tight under `.status`) and the existing
`.scorersGrid`/`.scorerRow`/`.scorerMins`/`.scorersEmpty` rules unchanged. Result:
Scorers reads as a continuation of the header block, not a separate panel, while
Lineup/Stats/Subs/Shootout keep their dashed-card treatment as today.

The `<h2>Scorers</h2>` heading stays (no test currently asserts its absence; removing
it isn't part of this ask).

## 4. Stats accuracy fix (`lib/merge.ts`, `extractStats()`)

Two distinct fixes inside `extractStats()` (lines ~214-245) — **not the same fix
applied twice**. Possession and Pass Accuracy have different mathematical shapes and
need different treatment:

**a. Possession: rounding must preserve the 100% invariant.** Home possession % +
away possession % always equals 100% in the raw ESPN data (it's the same 90 minutes
split two ways) — but rounding each side independently can break that (e.g. raw
49.5/50.5 → `Math.round` gives 50%/51%, summing to 101). Fix: round home's value only,
derive away as `100 - homeRounded`. This is specific to Possession — it does **not**
apply to Pass Accuracy (see below), which has no such invariant.

**b. Pass Accuracy: independent rounding is already correct, don't touch it.** Each
team's pass accuracy (`accuratePasses / totalPasses`) is its own independent number —
both teams can legitimately be at 85%, or both at 60%; there is no reason they should
sum to 100. The existing independent-rounding logic for Pass Accuracy is correct as-is
and must not be changed to derive one side from the other (that would introduce a bug,
not fix one).

**c. Missing-data display, for both stats.** When there's no real underlying data —
`totalPasses` is 0/absent for a side (Pass Accuracy), or `possessionPct` is absent for
both teams (Possession) — the row must display `–` rather than `0%`, which currently
happens because `num(undefined)` coerces to `0`. Concretely: `passAccuracy()`'s
existing `total === 0` branch currently returns the number `0`, which `percentRow`
formats as `"0%"`; instead it should signal "no data" so `percentRow` renders `–` for
that side without changing its numeric `value` (kept at `0` so the existing stat-bar
width calculation in `page.tsx`, which divides by `home.value + away.value`, is
unaffected — `MatchStatRow`'s `value: number` type does not need to change). Possession
gets the equivalent guard: if `raw(home, 'possessionPct')` and `raw(away,
'possessionPct')` are both absent, return `–`/`–` instead of computing from
`num(undefined) = 0`.

Only `Possession` and `Pass Accuracy` change — the plain counting stats (`Shots`,
`Passes`, `Fouls`, etc., via `plainRow`) already correctly fall back to `–` per-side
via `h ?? '–'` and are untouched.

## 5. Testing

- `lib/merge.test.ts`: extend the existing `extractStats` describe block with:
  - A Possession rounding-edge case where independent per-side rounding would
    previously have summed to ≠100 (e.g. possessionPct `49.5` / `50.5`), asserting the
    fixed output sums to 100.
  - A Pass Accuracy case with two different, both-legitimate percentages (e.g. home
    85%, away 60%) asserting they are **not** forced to sum to 100 — guards against
    reintroducing the derive-from-other-side mistake.
  - A no-data case: `totalPasses`/`accuratePasses` absent (or `possessionPct` absent
    for both teams) asserting `–`/`–` instead of `0%`/`0%`.
- `app/match/[id]/page.test.tsx`: update section-order assertions (Scorers now
  precedes the Lineup `<details>`) and drop/update any assertion tied to `.scorers`
  having card styling, if present. No new test needed purely for the CSS box removal
  (existing RTL tests assert on text/roles/testids, not computed styles).
- Full suite + `npm run typecheck` after the change.

## 6. Out of scope

- Venue/location display (📍) — no backing data source in this project.
- Any restructuring beyond section order/position (no new components, no tab UI).
- Chasing ESPN-vs-FIFA (or any other external site) numeric disagreement — accepted
  as an inherent data-source difference, not a code bug.
- `Shots`, `Passes`, `Fouls`, `Yellow/Red Cards`, `Offsides`, `Corners` calculation
  logic — already correct, untouched.
