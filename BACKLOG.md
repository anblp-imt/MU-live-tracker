# Backlog

Tracked items not yet implemented, so a future session doesn't lose context.

## Stats page (paused mid-brainstorm, 2026-07-18)

**Status:** architecture agreed, spec not yet written, not implemented.

- New page `app/stats/page.tsx`, own nav link.
- Local tab filter (PL / CL / FA / EFL / All) — same local-`useState` pattern as
  Standings and Schedule now use, no shared Context.
- Season overview only (per user's confirmed scope): Played, W-D-L, Goals For/Against,
  Goal Difference — computed from `Match[]` already returned by `/api/matches`, no new
  API calls or external data source.
- Explicitly out of scope (per brainstorm): top scorer/card leaderboards (would need
  per-match ESPN detail fetches for every finished match — expensive, needs its own
  design pass), head-to-head history (needs prior-season data the app doesn't fetch),
  home/away split and Fergie Time counts (asked about, not selected).
- Likely reuses `lib/result.ts`'s `matchResult()` (added 2026-07-18 for CupRun) for the
  W/D/L tally, same as `lib/standings.ts`'s `recentForm()` already does.

Resume with `superpowers:brainstorming` — the architecture questions are answered above;
what's left is the actual page layout/visual design pass, then `writing-plans`.

## Lint cleanup (found 2026-07-18, not fixed)

`npm run lint` (never part of this project's verification loop — only
test/typecheck/build have been checked) reports 4× `react-hooks/set-state-in-effect`:

- `app/page.tsx:28`, `app/standings/page.tsx:41`, `app/match/[id]/page.tsx:45` — all
  pre-date the 2026-07-18 UI session, all match the "effect chaining" pattern
  `LEARNING.md` section 3 documents as this codebase's deliberate teaching example, not
  a bug.
- `components/PageHeading.tsx:21` — added 2026-07-18 for the live clock. Deliberately
  `null`-initialized and set inside the effect rather than lazy-`useState(() => new
  Date())`, because several routes are statically prerendered at build time
  (`npm run build` shows `/`, `/schedule`, `/standings` as `○ (Static)`) — a lazy
  initializer would bake the build-time second into the static HTML, then briefly show
  a stale clock on hydration before the interval corrects it. Matches this file's
  existing precedent, not a new pattern.

Not fixed because: none of the 4 sites are things this session's actual verification
gate (test/typecheck/build) ever required clean, and 3 of the 4 are a documented
teaching pattern that isn't a bug. Worth a deliberate decision (add lint to the gate?
suppress with comments? actually restructure?) rather than a silent fix.
