# Match Detail Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the match detail page's score header, scorers list, and stat bars closer to the reference design from `WC-2026-live-tracker` (team crests, per-goal ⚽ rows, team-colored stat bars) — visual polish only, no new data or behavior.

**Architecture:** ESPN's `/summary` response already carries everything needed — `header.competitions[0].competitors[].team.color` (hex, no `#`) and `.logos[]` (an array of `{href, rel}`, picking the `dark` variant to suit the dark background, same pattern `FormationPitch.tsx`'s `jerseyKitUrl` already uses) — currently untyped and unused. One type addition (Task 1) unlocks three presentational changes to `app/match/[id]/page.tsx`/`page.module.css`: a crest+color-accented score header (Task 1), a per-goal icon list replacing the current single joined-string line per side (Task 2), and stat bars colored by each side's real team color instead of the fixed red/gold pair (Task 3). No `lib/merge.ts` extraction function changes — all three tasks work off data already flowing into the page.

**Tech Stack:** TypeScript, React (Next.js App Router), CSS Modules, Vitest — no new dependencies.

## Global Constraints

- No new npm dependencies.
- Crest/team-color usage must degrade gracefully: `logos`/`color` are optional fields (some ESPN responses omit them) — a missing crest must not render a broken `<img>`, and a missing color must fall back to the app's existing `--mu-red`/`--mu-gold` pair rather than `undefined` reaching a `style` attribute.
- Keep the existing dashed-border "ticket stub" card language (`var(--mu-surface)` background, `1.5px dashed rgba(201, 162, 39, 0.3)` border) for the Scorers section — this plan changes what's *inside* that card, not the card treatment itself, matching every other section on this page (Stats, Substitutions, Shootout).
- Run `npm test` and `npm run typecheck` after every task; run `npm run build` after the final task.
- Every commit message follows this repo's existing style (`feat:`/`fix:` + one-line summary, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).

---

### Task 1: Team crest + color-accented score header

**Files:**
- Modify: `lib/types.ts` (extend `EspnDetail.header.competitions[].competitors[].team`)
- Modify: `app/match/[id]/page.tsx`
- Modify: `app/match/[id]/page.module.css`
- Modify: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: nothing from another task in this plan (first task).
- Produces: `EspnDetail`'s header competitor `team` type now includes `color?: string` and `logos?: Array<{ href: string; rel?: string[] }>` — consumed by Task 3 (team-colored stat bars reuses the same `color` field, read the same way).

- [ ] **Step 1: Extend the type**

In `lib/types.ts`, find:

```typescript
      competitors?: Array<{ homeAway: 'home' | 'away'; team?: { id?: string; displayName?: string }; score?: string; shootoutScore?: string }>;
```

Replace with:

```typescript
      competitors?: Array<{
        homeAway: 'home' | 'away';
        team?: { id?: string; displayName?: string; color?: string; logos?: Array<{ href: string; rel?: string[] }> };
        score?: string;
        shootoutScore?: string;
      }>;
```

- [ ] **Step 2: Write the failing test**

In `app/match/[id]/page.test.tsx`, add this test inside the `describe('MatchDetailPage', ...)` block (place it after the existing `'renders scorers and lineups once the detail loads'` test):

```typescript
  it('shows each team\'s crest and a team-colored accent in the score header when ESPN provides them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              {
                homeAway: 'home', score: '1',
                team: {
                  id: '331', displayName: 'Brighton & Hove Albion', color: '0057B8',
                  logos: [{ href: 'https://example.com/331-default.png', rel: ['full', 'default'] }, { href: 'https://example.com/331-dark.png', rel: ['full', 'dark'] }],
                },
              },
              {
                homeAway: 'away', score: '2',
                team: { id: '360', displayName: 'Manchester United', color: 'DA020E' },
              },
            ],
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    const homeCrest = screen.getByAltText('Brighton & Hove Albion crest') as HTMLImageElement;
    expect(homeCrest.src).toBe('https://example.com/331-dark.png');
    // Manchester United has no `logos` in this fixture — no crest image should render for it.
    expect(screen.queryByAltText('Manchester United crest')).not.toBeInTheDocument();
  });

  it('does not crash the score header when ESPN omits team color and logos entirely', async () => {
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
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Brighton & Hove Albion')).toBeInTheDocument();
    expect(screen.queryByAltText('Brighton & Hove Albion crest')).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: The two new tests FAIL — no crest `<img>` exists yet, and `team.color`/`team.logos` aren't read anywhere yet. All previously-existing tests in this file still PASS unchanged.

- [ ] **Step 4: Add a crest-URL helper and use it in the score header**

In `app/match/[id]/page.tsx`, add this function near the top of the file, after `matchStatusText`:

```typescript
// Same dark-mode-variant preference as FormationPitch.tsx's jerseyKitUrl — a dark-on-
// transparent crest suits this page's dark background better than ESPN's default
// (light-background) render, when ESPN provides one at all.
function teamCrestUrl(team: { logos?: Array<{ href: string; rel?: string[] }> } | undefined): string | undefined {
  const logos = team?.logos || [];
  return logos.find(l => l.rel?.includes('dark'))?.href || logos[0]?.href;
}
```

Then replace the score header block:

```tsx
      <div className={styles.scoreHeader}>
        <span className={styles.teamName}>{displayTeamName(homeComp?.team?.displayName || '')}</span>
        <span className={styles.score}>{homeComp?.score ?? '-'} – {awayComp?.score ?? '-'}</span>
        <span className={styles.teamName}>{displayTeamName(awayComp?.team?.displayName || '')}</span>
      </div>
```

with:

```tsx
      <div className={styles.scoreHeader}>
        <div className={styles.teamBlock} style={{ '--team-accent': homeComp?.team?.color ? `#${homeComp.team.color}` : 'var(--mu-red)' } as React.CSSProperties}>
          {teamCrestUrl(homeComp?.team) && (
            <img className={styles.crest} src={teamCrestUrl(homeComp?.team)} alt={`${homeComp?.team?.displayName} crest`} loading="lazy" />
          )}
          <span className={styles.teamName}>{displayTeamName(homeComp?.team?.displayName || '')}</span>
        </div>
        <span className={styles.score}>{homeComp?.score ?? '-'} – {awayComp?.score ?? '-'}</span>
        <div className={styles.teamBlock} style={{ '--team-accent': awayComp?.team?.color ? `#${awayComp.team.color}` : 'var(--mu-gold)' } as React.CSSProperties}>
          <span className={styles.teamName}>{displayTeamName(awayComp?.team?.displayName || '')}</span>
          {teamCrestUrl(awayComp?.team) && (
            <img className={styles.crest} src={teamCrestUrl(awayComp?.team)} alt={`${awayComp?.team?.displayName} crest`} loading="lazy" />
          )}
        </div>
      </div>
```

- [ ] **Step 5: Add the CSS**

In `app/match/[id]/page.module.css`, replace:

```css
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
```

with:

```css
.scoreHeader {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--font-body);
  font-weight: 700;
}

.teamBlock {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
  border-bottom: 2px solid var(--team-accent, transparent);
}

.scoreHeader .teamBlock:last-child {
  flex-direction: row-reverse;
  text-align: right;
}

.crest {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}

.teamName {
  color: var(--mu-white);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts app/match/\[id\]/page.tsx app/match/\[id\]/page.module.css app/match/\[id\]/page.test.tsx
git commit -m "feat: show team crests and a team-color accent in the match score header"
```

---

### Task 2: Per-goal scorer rows with a ⚽ icon

**Files:**
- Modify: `app/match/[id]/page.tsx`
- Modify: `app/match/[id]/page.module.css`
- Modify: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `extractScorers` (existing, unchanged — returns `{ home: Array<{ name: string; mins: string[] }>; away: ...; redCards: ... }`), already imported and called in `page.tsx`.
- Produces: nothing consumed by another task.

**Context:** The current Scorers section renders one joined-string line per side (`Home: {name mins} · {name mins}...`). This task replaces it with one row per scorer (⚽ icon + name + minute(s)), matching the reference design's per-goal list — a name that scored twice still gets one row with both minutes comma-separated (`extractScorers` already groups by name into a single `mins: string[]`, so no data-shape change is needed, only the rendering).

- [ ] **Step 1: Write the failing test**

In `app/match/[id]/page.test.tsx`, add this test after the crest tests from Task 1:

```typescript
  it('renders one row per scorer with a ball icon, not a single joined line', async () => {
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
            details: [
              { scoringPlay: true, clock: { displayValue: "33'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }] },
              { scoringPlay: true, clock: { displayValue: "70'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Patrick Dorgu' } }] },
              { scoringPlay: true, clock: { displayValue: "80'" }, team: { id: '331' }, participants: [{ athlete: { displayName: 'Some Striker' } }] },
            ],
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    // Dorgu scored twice — grouped into ONE row showing both minutes, not two rows.
    expect(screen.getByText(/33'.*70'|70'.*33'/)).toBeInTheDocument();
    const scorerRows = screen.getAllByTestId('scorer-row');
    expect(scorerRows).toHaveLength(2); // one row for Dorgu (both goals), one for Some Striker
  });

  it('shows a placeholder, not an empty list, when a side has no scorers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion' }, score: '0' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '1' },
            ],
            details: [
              { scoringPlay: true, clock: { displayValue: "10'" }, team: { id: '360' }, participants: [{ athlete: { displayName: 'Bruno Fernandes' } }] },
            ],
          }],
        },
        rosters: [],
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getAllByTestId('scorer-row')).toHaveLength(1);
    expect(screen.getByTestId('scorers')).toHaveTextContent('—');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: The two new tests FAIL — no element has `data-testid="scorer-row"` yet (the current markup joins scorers into a single string per side, not one element per scorer). All previously-existing tests still PASS.

- [ ] **Step 3: Replace the Scorers section markup**

In `app/match/[id]/page.tsx`, replace:

```tsx
      <section className={styles.scorers}>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
```

with:

```tsx
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
```

- [ ] **Step 4: Add the CSS**

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
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--mu-surface);
  border: 1.5px dashed rgba(201, 162, 39, 0.3);
  border-radius: 3px;
}

.scorersGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
  font-size: 12.5px;
}

.scorerRow {
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.scorerRowAway {
  text-align: right;
}

.scorerMins {
  font-family: var(--font-mono);
  color: var(--mu-gold);
  font-size: 11px;
}

.scorersEmpty {
  opacity: 0.5;
  margin: 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/match/\[id\]/page.tsx app/match/\[id\]/page.module.css app/match/\[id\]/page.test.tsx
git commit -m "feat: render one scorer row with a ball icon per player, not one joined line"
```

---

### Task 3: Team-colored stat bars

**Files:**
- Modify: `app/match/[id]/page.tsx`
- Modify: `app/match/[id]/page.module.css`
- Modify: `app/match/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `team.color` from `EspnDetail`'s header competitors (Task 1's type extension) — same field, same optional-with-fallback handling as Task 1's score header accent.
- Produces: nothing consumed by another task — this is the plan's last task.

**Context:** The Match Stats bars (`.statBarHome`/`.statBarAway`) currently use the fixed `--mu-red`/`--mu-gold` pair regardless of which two teams are actually playing. This task colors them with each side's real ESPN team color, falling back to the same red/gold pair when ESPN doesn't provide one (friendlies sometimes omit `color`, per this plan's Global Constraints).

- [ ] **Step 1: Write the failing test**

In `app/match/[id]/page.test.tsx`, add this test after Task 2's tests:

```typescript
  it('colors the match stat bars with each team\'s real ESPN color, falling back to red/gold', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        header: {
          competitions: [{
            status: { type: { state: 'post' } },
            competitors: [
              { homeAway: 'home', team: { id: '331', displayName: 'Brighton & Hove Albion', color: '0057B8' }, score: '1' },
              { homeAway: 'away', team: { id: '360', displayName: 'Manchester United' }, score: '2' }, // no color -> fallback
            ],
          }],
        },
        rosters: [],
        boxscore: {
          teams: [
            { homeAway: 'home', statistics: [{ name: 'totalShots', displayValue: '10' }] },
            { homeAway: 'away', statistics: [{ name: 'totalShots', displayValue: '14' }] },
          ],
        },
      }),
    }));

    render(<MatchDetailPage />);
    await act(async () => { await Promise.resolve(); });

    const homeBar = screen.getByTestId('stat-bar-home');
    const awayBar = screen.getByTestId('stat-bar-away');
    expect(homeBar.style.background).toBe('rgb(0, 87, 184)'); // #0057B8
    expect(awayBar.style.getPropertyValue('background')).toContain('var(--mu-gold)');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: FAILS — no element has `data-testid="stat-bar-home"`/`"stat-bar-away"` yet, and the bars aren't colored per-team. All previously-existing tests still PASS.

- [ ] **Step 3: Thread team colors into the stat bars**

In `app/match/[id]/page.tsx`, find the variable declarations block (where `scorers`, `stats`, `subs`, `shootout` are computed) and add two new lines right after them:

```typescript
  const homeColor = homeComp?.team?.color ? `#${homeComp.team.color}` : 'var(--mu-red)';
  const awayColor = awayComp?.team?.color ? `#${awayComp.team.color}` : 'var(--mu-gold)';
```

Then replace the stat bar JSX:

```tsx
                <div className={styles.statBar}>
                  <span className={styles.statBarHome} style={{ width: `${homePct}%` }} />
                  <span className={styles.statBarAway} style={{ width: `${100 - homePct}%` }} />
                </div>
```

with:

```tsx
                <div className={styles.statBar}>
                  <span className={styles.statBarHome} data-testid="stat-bar-home" style={{ width: `${homePct}%`, background: homeColor }} />
                  <span className={styles.statBarAway} data-testid="stat-bar-away" style={{ width: `${100 - homePct}%`, background: awayColor }} />
                </div>
```

- [ ] **Step 4: Drop the now-redundant fixed colors from the CSS**

In `app/match/[id]/page.module.css`, remove the two rules that set a fixed color (the inline `style` from Step 3 now sets `background` per-instance, so these static rules would only ever be a dead fallback that never shows — CSS Modules doesn't warn about this, so remove it explicitly rather than leave dead code):

Delete:

```css
.statBarHome {
  background: var(--mu-red);
}

.statBarAway {
  background: var(--mu-gold);
}
```

`.statBar`'s own rule (the flex container with `overflow: hidden` etc.) stays untouched — only these two color-only rules are removed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/match/\[id\]/page.test.tsx`
Expected: PASS (all tests in this file, old and new)

- [ ] **Step 6: Run the full suite, typecheck, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: PASS; build succeeds with no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/match/\[id\]/page.tsx app/match/\[id\]/page.module.css app/match/\[id\]/page.test.tsx
git commit -m "feat: color match stat bars with each team's real ESPN color"
```

---

## Self-Review Notes

- **Spec coverage:** the user's confirmed decision — bring score header, scorers, and stats closer to the WC-2026 reference (crests, colored accents, per-goal rows, team-colored bars) — is covered by Task 1 (crest + color accent), Task 2 (per-goal rows), Task 3 (colored bars). The reference's top round/date badge and full background-fill team blocks were deliberately **not** copied 1:1 (see Task 1's Context: a border-accent, not a background fill, avoids a contrast/accessibility problem — some real team colors are light, e.g. white or pale yellow kits, and would make white text unreadable if used as a full background) — this is a scoped design adaptation, not a missed requirement.
- **Placeholder scan:** none — every step has complete, runnable code.
- **Type consistency:** `team.color`/`team.logos` (Task 1's type extension) are read identically in Task 1 (score header) and Task 3 (stat bars) — same optional-chaining + `#`-prefix + fallback pattern in both places, so a future reader sees one consistent idiom for "ESPN team color, with fallback" rather than two different ones.
