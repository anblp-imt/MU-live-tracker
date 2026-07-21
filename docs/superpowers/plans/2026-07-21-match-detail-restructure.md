# Match Detail Restructure & Stats Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two real bugs in the match detail page's stats calculation (`extractStats()`), then reorder the page so Scorers sits right under the score/status (not boxed, not buried below Lineup) and the remaining sections follow Lineup → Stats → Substitutions → Shootout.

**Architecture:** Two independent, sequential changes to existing files — no new components, no new files, no type changes. Task 1 is a pure `lib/` logic fix (TDD, `lib/merge.test.ts`). Task 2 is a JSX reorder + CSS class trim in the existing page component (`app/match/[id]/page.tsx`, `page.module.css`), with one new regression test asserting DOM order.

**Tech Stack:** Next.js (App Router), React (Client Component), TypeScript, Vitest + React Testing Library, CSS Modules.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-21-match-detail-restructure-design.md`.
- `MatchStatRow`'s `value: number` type (`lib/types.ts:67-71`) does not change — missing-data rows keep `value: 0`, only `display` becomes `'–'`.
- Possession's "derive away from home" fix applies **only** to Possession, never to Pass Accuracy (they have different mathematical shapes — see spec §4).
- No venue/location display, no new components, no tab UI — out of scope per spec §6.
- Run `npm test` (or the project's equivalent Vitest command) and `npm run typecheck` after each task.

---

### Task 1: Fix Possession & Pass Accuracy bugs in `extractStats()`

**Files:**
- Modify: `lib/merge.ts:214-245` (the `extractStats` function)
- Test: `lib/merge.test.ts` (the `describe('extractStats', ...)` block, currently at lines 249-282)

**Interfaces:**
- Consumes: `EspnDetail` (from `lib/types.ts`), specifically `detail.boxscore.teams[].statistics[]` (`{ name: string; displayValue: string }[]`).
- Produces: `extractStats(detail: EspnDetail): MatchStatRow[]` — same signature as today. `MatchStatRow` shape unchanged: `{ label: string; home: { display: string; value: number }; away: { display: string; value: number } }`.

- [ ] **Step 1: Write the three failing tests**

Add these three `it` blocks inside the existing `describe('extractStats', ...)` in `lib/merge.test.ts`, right after the existing `'returns an empty list when boxscore stats are unavailable'` test (i.e. before the closing `});` of the describe block, currently line 281-282):

```ts
  it('rounds possession so home and away always sum to 100%, even when independent rounding would not', () => {
    const detail: EspnDetail = {
      header: { competitions: [{ status: { type: { state: 'post' } } }] },
      boxscore: {
        teams: [
          { homeAway: 'home', statistics: [{ name: 'possessionPct', displayValue: '49.5' }] },
          { homeAway: 'away', statistics: [{ name: 'possessionPct', displayValue: '50.5' }] },
        ],
      },
    };
    const result = extractStats(detail);
    // Independent rounding would give 50%/51% (sums to 101) — home must be rounded first
    // and away derived as 100 - home, so the pair always sums to exactly 100.
    expect(result.find(r => r.label === 'Possession')).toEqual({
      label: 'Possession', home: { display: '50%', value: 50 }, away: { display: '50%', value: 50 },
    });
  });

  it('computes pass accuracy independently per team — the two are not forced to sum to 100%', () => {
    const detail: EspnDetail = {
      header: { competitions: [{ status: { type: { state: 'post' } } }] },
      boxscore: {
        teams: [
          { homeAway: 'home', statistics: [{ name: 'totalPasses', displayValue: '400' }, { name: 'accuratePasses', displayValue: '340' }] },
          { homeAway: 'away', statistics: [{ name: 'totalPasses', displayValue: '300' }, { name: 'accuratePasses', displayValue: '180' }] },
        ],
      },
    };
    const result = extractStats(detail);
    // 340/400 = 85%, 180/300 = 60% — deliberately not summing to 100, proving neither
    // side is derived from the other (unlike Possession).
    expect(result.find(r => r.label === 'Pass Accuracy')).toEqual({
      label: 'Pass Accuracy', home: { display: '85%', value: 85 }, away: { display: '60%', value: 60 },
    });
  });

  it('shows a dash instead of 0% when a percentage stat has no underlying data', () => {
    const detail: EspnDetail = {
      header: { competitions: [{ status: { type: { state: 'post' } } }] },
      boxscore: {
        teams: [
          { homeAway: 'home', statistics: [{ name: 'totalPasses', displayValue: '0' }, { name: 'foulsCommitted', displayValue: '3' }] },
          { homeAway: 'away', statistics: [{ name: 'totalPasses', displayValue: '0' }, { name: 'foulsCommitted', displayValue: '2' }] },
        ],
      },
    };
    const result = extractStats(detail);
    // possessionPct is absent entirely for both teams; totalPasses is present but 0 for
    // both — neither case has real data, so both must read '–', not a misleading '0%'.
    expect(result.find(r => r.label === 'Possession')).toEqual({
      label: 'Possession', home: { display: '–', value: 0 }, away: { display: '–', value: 0 },
    });
    expect(result.find(r => r.label === 'Pass Accuracy')).toEqual({
      label: 'Pass Accuracy', home: { display: '–', value: 0 }, away: { display: '–', value: 0 },
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/merge.test.ts -t extractStats`
Expected: the 3 new tests FAIL (the first two fail because the current code gives `away: { display: '51%', value: 51 }` and doesn't yet exist as a code path being tested for; the third fails because current code returns `'0%'`/`value: 0` instead of `'–'`/`value: 0`). The two pre-existing tests in this block still PASS.

- [ ] **Step 3: Implement the fix**

Replace the current `extractStats` function in `lib/merge.ts` (lines 214-245) with:

```ts
export function extractStats(detail: EspnDetail): MatchStatRow[] {
  const teams = detail.boxscore?.teams || [];
  const home = teams.find(t => t.homeAway === 'home');
  const away = teams.find(t => t.homeAway === 'away');
  if (!home?.statistics?.length || !away?.statistics?.length) return [];

  const raw = (team: typeof home, name: string) => team?.statistics?.find(s => s.name === name)?.displayValue;
  const num = (v: string | undefined) => { const n = parseFloat(v || ''); return Number.isFinite(n) ? n : 0; };
  const plainRow = (label: string, name: string): MatchStatRow => {
    const h = raw(home, name);
    const a = raw(away, name);
    return { label, home: { display: h ?? '–', value: num(h) }, away: { display: a ?? '–', value: num(a) } };
  };
  // homeVal/awayVal are `null` when there's no underlying data for that side — displayed
  // as '–' rather than a misleading '0%'. `value` stays 0 in that case so the stat-bar
  // width calc in page.tsx (which divides by home.value + away.value) is unaffected.
  const percentRow = (label: string, homeVal: number | null, awayVal: number | null): MatchStatRow => ({
    label,
    home: { display: homeVal === null ? '–' : `${homeVal}%`, value: homeVal ?? 0 },
    away: { display: awayVal === null ? '–' : `${awayVal}%`, value: awayVal ?? 0 },
  });
  // Home and away possession always sum to 100% in the raw data (same 90 minutes split
  // two ways) — round home only and derive away from it, so independent per-side
  // rounding (e.g. 49.5/50.5 -> 50%/51%) can never break that invariant.
  const possessionRow = (): MatchStatRow => {
    const h = raw(home, 'possessionPct');
    const a = raw(away, 'possessionPct');
    if (h == null && a == null) return percentRow('Possession', null, null);
    const homePct = Math.round(num(h));
    return percentRow('Possession', homePct, 100 - homePct);
  };
  // Unlike possession, each team's pass accuracy is independent (both can legitimately
  // be at 85%) — rounded separately, never derived from the other side.
  const passAccuracy = (team: typeof home): number | null => {
    const total = num(raw(team, 'totalPasses'));
    return total ? Math.round(num(raw(team, 'accuratePasses')) / total * 100) : null;
  };

  return [
    plainRow('Shots', 'totalShots'),
    plainRow('Shots on Target', 'shotsOnTarget'),
    possessionRow(),
    plainRow('Passes', 'totalPasses'),
    percentRow('Pass Accuracy', passAccuracy(home), passAccuracy(away)),
    ...PLAIN_STAT_DEFS.map(({ label, name }) => plainRow(label, name)),
  ];
}
```

- [ ] **Step 4: Run the full `extractStats` test group to verify all pass**

Run: `npx vitest run lib/merge.test.ts -t extractStats`
Expected: all 5 tests PASS (the 2 pre-existing plus the 3 new ones).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run` then `npm run typecheck`
Expected: all PASS, no type errors (no other file references the internal `passAccuracy`/`percentRow`/`possessionRow` helpers — they're local to `extractStats` — so no ripple effects expected).

- [ ] **Step 6: Commit**

```bash
git add lib/merge.ts lib/merge.test.ts
git commit -m "$(cat <<'EOF'
fix: keep possession at 100% and show – instead of 0% for missing stats

Possession's home/away percentages were rounded independently, which
could break the 100% invariant (e.g. 49.5/50.5 -> 50%/51%). Round home
only and derive away as 100 - home. Separately, Pass Accuracy and
Possession showed a misleading 0% when there was no underlying data
(e.g. totalPasses absent) instead of -.
EOF
)"
```

---

### Task 2: Move Scorers next to the score header, reorder the remaining sections

**Files:**
- Modify: `app/match/[id]/page.tsx:98-222` (the component's `return` JSX)
- Modify: `app/match/[id]/page.module.css:133-139` (the `.scorers` rule)
- Test: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `scorers`, `stats`, `subs`, `shootout`, `homeColor`, `awayColor`, `home`, `away`, `matchState`, `subCount` — all already computed earlier in the component (lines 82-96), unchanged by this task.
- Produces: no new exports; this task only reorders existing JSX blocks and removes CSS properties from an existing class.

- [ ] **Step 1: Write the failing DOM-order test**

Add this `it` block to `app/match/[id]/page.test.tsx`, after the existing `'shows a placeholder, not an empty list, when a side has no scorers'` test (around line 175-176):

```tsx
  it('places Scorers before the Starting Lineup details, so it reads as part of the persistent header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '1' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '2' },
            ],
            details: [{ scoringPlay: true, clock: { displayValue: "33'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }] }],
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    const scorersSection = screen.getByTestId('scorers');
    const lineupDetails = screen.getByText('Starting Lineup').closest('details')!;
    // DOCUMENT_POSITION_FOLLOWING on lineupDetails (from scorersSection's perspective)
    // means scorersSection comes first in the DOM.
    expect(scorersSection.compareDocumentPosition(lineupDetails) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/match/[id]/page.test.tsx -t "places Scorers before"`
Expected: FAIL — under the current order, `lineupDetails` precedes `scorersSection` in the DOM, so `compareDocumentPosition` returns `DOCUMENT_POSITION_PRECEDING` (2) instead of `DOCUMENT_POSITION_FOLLOWING` (4), and the bitwise `&` is falsy.

- [ ] **Step 3: Reorder the JSX**

In `app/match/[id]/page.tsx`, replace the whole block from the `<p className={styles.status}>` line through the closing `</main>` (lines 127-221) with:

```tsx
      <p className={styles.status}>{matchStatusText(data)}</p>
      <section className={styles.scorers} data-testid="scorers">
        <h2>Scorers</h2>
        <div className={styles.scorersGrid}>
          <div>
            {scorers.home.length === 0 && <p className={styles.scorersEmpty}>—</p>}
            {scorers.home.map(s => (
              <div className={styles.scorerRow} data-testid="scorer-row" key={s.name}>
                <span aria-hidden="true">⚽</span> {s.name} <span className={styles.scorerMins}>{s.mins.join(', ')}</span>
              </div>
            ))}
          </div>
          <div>
            {scorers.away.length === 0 && <p className={styles.scorersEmpty}>—</p>}
            {scorers.away.map(s => (
              <div className={`${styles.scorerRow} ${styles.scorerRowAway}`} data-testid="scorer-row" key={s.name}>
                <span className={styles.scorerMins}>{s.mins.join(', ')}</span> {s.name} <span aria-hidden="true">⚽</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* key={matchState} remounts only when pre/in/post actually changes, resetting
          the default open/closed state at that transition — a poll within the same
          phase re-renders without remounting, so a manual toggle by the user survives
          it instead of snapping back open/closed every 30s. */}
      <details key={matchState} open={matchState === 'pre'}>
        <summary className={styles.lineupSummary}>Starting Lineup</summary>
        <FormationPitch homeRoster={home} awayRoster={away} />
      </details>
      {stats.length > 0 && (
        <section className={styles.stats} data-testid="stats">
          <h2>Match Stats</h2>
          {stats.map(row => {
            const total = row.home.value + row.away.value;
            const homePct = total ? (row.home.value / total) * 100 : 50;
            return (
              <div className={styles.statRow} key={row.label}>
                <div className={styles.statVals}>
                  <span className={styles.statHome}>{row.home.display}</span>
                  <span className={styles.statLabel}>{row.label}</span>
                  <span className={styles.statAway}>{row.away.display}</span>
                </div>
                <div className={styles.statBar}>
                  <span data-testid="stat-bar-home" style={{ width: `${homePct}%`, background: homeColor }} />
                  <span data-testid="stat-bar-away" style={{ width: `${100 - homePct}%`, background: awayColor }} />
                </div>
              </div>
            );
          })}
        </section>
      )}
      {subCount > 0 && (
        <details className={styles.subsDetails} data-testid="substitutions">
          <summary className={styles.lineupSummary}>{subCount} Substitution{subCount === 1 ? '' : 's'}</summary>
          <div className={styles.subsGrid}>
            <div>
              {subs.home.map((s, i) => (
                <div className={styles.subRow} key={i}>
                  <span className={styles.subMin}>{s.min}</span>
                  <span><span className={styles.subIn}>↑</span> {s.playerIn} <span className={styles.subOut}>↓ {s.playerOut}</span></span>
                </div>
              ))}
            </div>
            <div>
              {subs.away.map((s, i) => (
                <div className={styles.subRow} key={i}>
                  <span className={styles.subMin}>{s.min}</span>
                  <span><span className={styles.subIn}>↑</span> {s.playerIn} <span className={styles.subOut}>↓ {s.playerOut}</span></span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
      {shootout && (
        <section className={styles.shootout} data-testid="shootout">
          <h2>Penalty Shootout <span className={styles.shootoutScore}>{shootout.homeScore} – {shootout.awayScore}</span></h2>
          <div className={styles.shootoutGrid}>
            {shootout.rounds.map((round, i) => (
              <div className={styles.shootoutRow} key={i}>
                <span className={`${styles.shootoutShot} ${styles.shootoutHome} ${round.home ? (round.home.scored ? styles.scored : styles.missed) : ''}`}>
                  {round.home ? `${round.home.scored ? '✓' : '✗'} ${round.home.player}` : ''}
                </span>
                <span className={styles.shootoutRound}>{i + 1}</span>
                <span className={`${styles.shootoutShot} ${styles.shootoutAway} ${round.away ? (round.away.scored ? styles.scored : styles.missed) : ''}`}>
                  {round.away ? `${round.away.scored ? '✓' : '✗'} ${round.away.player}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
```

(Every inner block is copied verbatim from the current file — only its position changed. No prop, guard, or handler logic changes.)

- [ ] **Step 4: Strip the boxed-card styling from `.scorers`**

In `app/match/[id]/page.module.css`, replace:

```css
.scorers {
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(201, 162, 39, 0.3);
  border-radius: 3px;
}
```

with:

```css
.scorers {
  margin-top: 4px;
}
```

(`.status`'s existing `margin: 2px 0 16px` already provides the vertical gap above; `.scorersGrid`/`.scorerRow`/`.scorerMins`/`.scorersEmpty` rules are untouched.)

- [ ] **Step 5: Run the full page test file to verify everything passes**

Run: `npx vitest run app/match/[id]/page.test.tsx`
Expected: all tests PASS, including the new DOM-order test. In particular, re-check:
`'renders stats, substitutions and a penalty shootout when the detail includes them'` (asserts each section exists via `getByTestId`, not their relative order — unaffected by the reorder) and `'omits stats/substitutions/shootout sections when the detail has none of that data'` (guards unchanged).

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npx vitest run` then `npm run typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 7: Manually verify in the browser**

Use the `run` skill to start the dev server and open a match detail page (live or finished, so Scorers/Stats have data). Confirm visually: Scorers sits directly under the status line with no card border/background, followed by the (collapsed by default, unless pre-match) Starting Lineup, then Stats, then Substitutions (if any), then Shootout (if any).

- [ ] **Step 8: Commit**

```bash
git add app/match/\[id\]/page.tsx app/match/\[id\]/page.module.css app/match/\[id\]/page.test.tsx
git commit -m "$(cat <<'EOF'
feat: move Scorers next to the score header, reorder detail sections

Scorers now renders directly under the status line with no card
chrome, ahead of the Starting Lineup — reads as part of the persistent
header instead of a separate boxed section buried below it. The
remaining sections now follow Lineup -> Stats -> Substitutions ->
Shootout, matching wc-2026-live-tracker's detail-panel order.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (order) → Task 2 Step 3. §3 (Scorers styling) → Task 2 Step 4. §4a/§4b/§4c (stats fixes) → Task 1 Step 3. §5 (testing) → Task 1 Steps 1/4, Task 2 Step 1. §6 (out of scope) — no task touches venue, adds components, or changes the plain-stat rows; confirmed by inspection of the Task 1 diff (only `percentRow`/`possessionRow`/`passAccuracy` change; `plainRow` and `PLAIN_STAT_DEFS` are untouched).
- **Placeholder scan:** no TBD/TODO markers; every step shows complete code, not a description of code.
- **Type consistency:** `MatchStatRow` shape (`{ label, home: { display, value }, away: { display, value } }`) matches between Task 1's implementation and the pre-existing type in `lib/types.ts` — unchanged. `percentRow(label: string, homeVal: number | null, awayVal: number | null): MatchStatRow` is the only new-shaped helper, and it's local to `extractStats`, not exported or consumed elsewhere — no cross-task signature mismatch possible.
