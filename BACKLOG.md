# Backlog

Tracked items not yet implemented, so a future session doesn't lose context.

## Match Stats accuracy vs Google (raised 2026-07-21, not started)

**Status:** researched, no design/spec yet.

User compared Match Stats numbers against Google's own match-stats card and found them
not closely matching. Root cause confirmed by inspection, not a bug: both this app and
its predecessor `wc-2026-live-tracker` (`lib/merge.ts`'s `extractStats`/`STAT_DEFS` was
ported directly from `WC-2026-live-tracker/render.js`'s `STAT_DEFS`, same ESPN field
names) pull stats exclusively from ESPN's summary endpoint. Google's match-stats card is
sourced from a different data provider (likely Opta/Gracenote), which uses different
counting rules — some disagreement between the two is expected and isn't fixable by
changing our calculation logic (already fixed the two real calc bugs there were:
possession rounding, missing-data 0% — see `2026-07-21-match-detail-restructure-design.md`).

Only real lever: add or switch to a second data source. Discussed API-Football
(api-football.com / API-Sports) as a candidate — has a documented `/players/squads` +
`transfers` endpoint (see the roster-staleness item below, same candidate), but free tier
is 100 requests/day shared across all endpoints, too tight for live-match stat polling;
would only be viable for slow-changing data, not stats during a live match. No guarantee
its numbers match Google either — different provider, same fundamental issue.

Needs a brainstorm session to decide: is closer-to-Google accuracy worth a paid API-Football
plan (or another provider), and if so scoped to which data (live stats? roster only? both)?

## Roster jersey numbers stale after real-world transfers (raised 2026-07-21, not started)

**Status:** researched, no design/spec yet.

ESPN's per-match roster (`EspnRoster`, used by `FormationPitch`) lags real transfers —
e.g. shirt numbers 17/18 didn't reflect real signings (Andrey Santos, Youri Tielemans)
at time of writing. API-Football's `/players/squads?team=X` endpoint returns the current
registered squad in one call and has a dedicated `transfers` endpoint — a better fit for
this specific problem than for the live-stats accuracy problem above, since squad/transfer
data changes slowly and comfortably fits the free tier's 100 req/day (cacheable ~24h).
Would need: API key as an env secret, a merge strategy against the existing ESPN roster
(match by name — no shared ID between providers), and handling requests exceeding the
daily quota gracefully.

Candidate for the same brainstorm session as the Stats-accuracy item above, since both
point at the same external API — worth deciding together whether to integrate it at all
before scoping either piece individually.

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
