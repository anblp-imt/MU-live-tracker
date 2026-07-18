# MU Live Tracker — Progress Log (committed copy of the SDD ledger)

> The subagent-driven-development skill keeps its working ledger at
> `.superpowers/sdd/progress.md`, which is **git-ignored by design** (it's a
> scratch workspace — task briefs, implementer reports, review diffs — not a
> project deliverable). That means a fresh session on another machine that
> only pulls from git cannot see it. This file is a periodically-updated,
> **committed** copy of that ledger's content, kept for exactly that
> handoff case. If you are a fresh Claude session picking this up: read this
> file first, then `git log --oneline` to confirm HEAD, then resume with the
> plan at `docs/superpowers/plans/2026-07-16-mu-live-tracker-plan.md` and the
> `superpowers:subagent-driven-development` skill.

Plan: `docs/superpowers/plans/2026-07-16-mu-live-tracker-plan.md` (28 tasks)
Branch: `main` (direct commits — new repo, no parallel work, per user decision 2026-07-16)
Last synced to `.superpowers/sdd/progress.md` at: commit `09c467b` (2026-07-17)

## Status: All 28 tasks complete and committed (HEAD 543bee5). Final whole-branch
verification and finishing-a-development-branch remain.

```
Task 1:  complete (commits 27be07e..c52e2e2, review clean — Approved)
Task 2:  complete (commits c52e2e2..3c1e196, review clean — Approved)
Task 3:  complete (commits 3c1e196..930a0c8, includes controller fix for stray-file scope leak — Approved)
Task 4:  complete (commits 930a0c8..f3a61ee, review clean — Approved)
Task 5:  complete (commits f3a61ee..f8fa80f, review clean — Approved)
Task 6:  complete (commits f8fa80f..aa18417, review clean — Approved)
Task 7:  complete (commits aa18417..79b85e4, review clean incl. mutation-verified TTL test — Approved)
Task 8:  complete (commits 79b85e4..b390af7, review clean — Approved; minor: commit msg says
         "August" but code correctly implements July threshold per brief)
Task 9:  complete (commits b390af7..e21139a across 3 sub-phases, 11/11 tests, review Approved).
         Mid-task fix: mergeMatches joins FD<->ESPN by calendar day (not full matchKey)
         because FD always suffixes opponent names ("Hull City AFC") and ESPN never does
         ("Hull City") — discovered by implementer, verified correct by reviewer, relies
         on "MU plays <=1 fixture/day" invariant.
         Follow-up for final review (non-blocking, reviewer-confirmed): day-join has no
         defense-in-depth opponent-identity cross-check; ESPN-enriched status/minute can
         pair with a stale FD score until FD's own poll catches up (inherited from
         original design, not introduced by the fix).
Task 10: complete (commits e21139a..894c3cb, review clean — Approved)
Task 11: complete (commits 894c3cb..7e8dabd, review clean — Approved)
--- Milestone 1 (BFF foundation, lib/) complete: Tasks 1-11 all Approved ---
Task 12: complete (commits 7e8dabd..a168c22, review clean incl. hand-traced allSettled
         degrade logic — Approved; live smoke test: 39 matches, season 2026-27, sources
         fd+espn both true)
Task 13: complete (commits a168c22..6aa29c7, review clean — Approved; live smoke test:
         20 PL standings rows correct shape)
         Controller housekeeping: gitignored .claude/ (commit 5dab4be) to prevent future
         scope-leak like Task 3's incident
Task 14: complete (commits 5dab4be..dc57109, review clean — Approved; live smoke test:
         event 740966, 2 rosters, state=post)
--- Milestone 1b (API routes) complete: Tasks 12-14 all Approved ---
Task 15: complete (commits dc57109..87fcf9f, review clean — Approved). Milestone A begun.
Task 16: complete (commits 87fcf9f..b247bff, review clean — Approved).
         Note: fixed another plan-authored test-fixture bug (venue/opponent mismatch vs
         MatchCard's actual selection logic), verified independently correct by reviewer.
Task 17: complete (commits b247bff..e05ca53, review clean — Approved).
         Milestone A complete: Tasks 15-17.
Task 18: complete (commits e05ca53..977588f across 2 sub-phases, review clean — Approved).
         Note: 3rd occurrence of venue/opponent fixture bug (same class as Task 16), fixed
         with the same established one-line remedy, verified independently correct by
         reviewer. Controller then audited all remaining plan test fixtures (Tasks 19-27)
         for the same pattern; found and fixed one more real occurrence in Task 21's
         not-yet-implemented brief (commit 246fa18), confirmed no other occurrences remain.
--- Milestone B (state, lifting state up) complete: Task 18 ---
Task 19: complete (commits 246fa18..dd15fc9 across 2 sub-phases, 11/11 tests, review
         clean — Approved).
         Central usePolling hook: reviewer independently hand-traced the effect execution
         order and confirmed the corrected fetcher-call-count sequence (1,2,2,3) matches
         the hook's actual (correct) behavior — 3 brief-authored test bugs found and
         fixed, hook code itself untouched/verbatim from brief. Pristine test output
         confirmed across multiple runs.
Task 20: complete (commit c1b795f, 18/18 tests, review clean — Approved).
         isFergieTime hand-traced independently by reviewer across all 5 cases, correct.
         Minor note (non-blocking): MatchCard.test.tsx regression fixture has a harmless
         venue/name mismatch (no assertion depends on it) — left as-is per reviewer.
Task 21: complete (commit e81b721, 4/4 tests x3 runs, build+typecheck clean, review
         clean — Approved).
         Reviewer independently re-traced the fetch-call-count mechanism through
         usePolling.ts and app/page.tsx, confirmed identical to Task 19's already-verified
         behavior.
--- Milestone C (useEffect, cleanup, refs) complete: Tasks 19-21 ---
Task 22: complete (commits e81b721..d8d64dc across 2 sub-phases, 100/100 full-suite
         tests, review clean — Approved).
         KNOWN GAP: brief's manual browser click-through (pill click -> list updates)
         could not be performed — no browser-automation tool available to implementer or
         controller. Substituted with curl SSR check + hand-traced component tree (single
         provider wraps both consumers, no prop-drilling gap) + structurally-identical
         passing unit test. Reviewer judged this an acceptable stand-in but NOT equivalent
         to real hydrated click verification. User should spot-check this manually via
         `npm run dev` -> /schedule -> click a nav pill, if desired.
--- Milestone D (Context) complete: Task 22 ---
Task 23: complete (commit 51221c9, 4/4 tests, review clean — Approved).
         Reviewer found a 2nd, deeper bug in the plan's own reference code (not just a
         test fixture): buildFormationRows([], '4-3-3') per the brief's literal Step 3
         code produces FOUR empty rows (one per rowCounts entry) instead of the mandated
         single [[]], because the loop pushes an empty slice per rowCount regardless of
         roster size. Controller hand-verified this trace independently — confirmed
         correct. Implementer's added `if (players.length === 0) return [[]]` guard is
         the correct, necessary fix (verified: 4/4 tests pass, typecheck clean).
         Implementer's report mischaracterized this as "matches the brief's
         already-specified guard" — it's actually a second, undocumented fix beyond what
         the brief's players[0]-ternary guard alone provides. Code is correct; only the
         report's framing was inaccurate. No further action needed.
Task 24: complete (commit 51af582, 3/3 tests, review clean — Approved).
         Reviewer independently confirmed the vi.spyOn memoization test genuinely proves
         useMemo works (not just "looks memoized") via a mental remove-useMemo check.

--- Session handoff 2026-07-17: all commits through 09c467b pushed to origin/main ---
Task 25: complete (commit 09c467b, 2/2 tests, review clean — Approved). Scope confirmed
         (CupRun.tsx + CupRun.test.tsx only), code verbatim from plan Step 3, fixture
         hand-traced (venue: 'H' + opponent in away.name — no mismatch), sort order
         correct, deliberately unmemoized per design.
--- Milestone E (derived state, useMemo) complete: Tasks 23-25 ---
Task 26: complete (commit 6da563c, 2/2 tests, typecheck clean). Standings page: PL/CL
         tables via local tab state, FA/EFL delegate to CupRun. Verbatim from plan.
Task 27: complete (commit 08fb6b4, 3/3 tests, full suite 114/114, typecheck + `next
         build` both clean). Match detail page: usePolling gated to 30s only while
         state === 'in', FormationPitch + extractScorers wired in.
         Found and fixed a 4th occurrence of the fake-timers/waitFor bug class (Tasks
         19/21): the plan's "fetch fails" test called `waitFor()` under
         `vi.useFakeTimers()`, which hangs (waitFor's internal poll uses setTimeout,
         also faked) — replaced with the `act()`+`Promise.resolve()` pattern already
         established in app/page.test.tsx. Test-only fix, component code untouched.
         Also verified (not just assumed) that `useSearchParams` without a `<Suspense>`
         boundary — required by Next 16 docs for statically-prerendered routes — is a
         non-issue here: `next build` confirms `/match/[id]` renders dynamically (ƒ),
         not statically, since it has no generateStaticParams.
--- Milestone F (remaining pages) complete: Tasks 26-27 ---
Task 28: complete (commit 543bee5). LEARNING.md added verbatim per plan, indexed by
         Milestones A-E.
--- All 28 tasks complete ---
```

## Recurring pattern worth knowing before resuming

Several tasks in this plan found genuine bugs in the plan document's own test
fixtures/reference code, not implementation mistakes:

- **Venue/opponent-name mismatch** (Tasks 16, 18, and one pre-emptively fixed
  in Task 21's brief via commit `246fa18`): a `Match` fixture with `venue: 'A'`
  but the asserted opponent text actually corresponds to `away.name` — since
  `MatchCard`/`CupRun` select the displayed name via
  `venue === 'H' ? away.name : home.name`, this class of fixture needs
  `venue: 'H'` whenever the test expects to see the name stored in `away.name`.
  Confirmed not to recur in Tasks 20, 23, 24 (checked, harmless or absent).
- **Effect-timing/call-count assumptions** (Task 19, then again in Task 21):
  `usePolling`'s `[intervalMs]` effect calls `run()` unconditionally on every
  execution (mount AND every dependency change), which some of the plan's own
  test expectations didn't originally account for.
- **A deeper algorithmic gap** (Task 23): the plan's literal
  `buildFormationRows` reference code fails its own mandated
  `buildFormationRows([], '4-3-3')` → `[[]]` test case (produces 4 empty rows
  instead of 1) — fixed with an explicit `players.length === 0` early return.

None of these affected already-shipped, already-approved behavior — each was
caught by TDD (a RED test) before merge, exactly as the process is meant to
work.
