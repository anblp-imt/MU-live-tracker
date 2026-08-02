# Match Detail Mobile Polish — Design

**Goal:** Match detail is the most-used tab. On phones, its header controls overflow/wrap awkwardly, long team names get cut off with no way to read them, and the pitch view doesn't show who scored or assisted. Fix all three, plus a small unrelated color fix (GK circle color).

## 1. Compact header controls (mobile ≤460px only)

Affects `components/PageHeading.tsx`/`.module.css` (Match/Standings/Stats pages) and `app/match/[id]/MatchDetailClient.tsx`/`page.module.css` (its own copy, per the existing code comment explaining why it's duplicated).

Both already share the same markup shape:
```tsx
<span data-testid="sync-status">✓ Synced 12:34:56</span> {/* or ✗ Refresh failed */}
<button onClick={onRefresh}><span>↻</span> Refresh</button>
```

Desktop is unaffected. Inside the existing `@media (max-width: 460px)` block (already added in both files for the wrap fallback), visually hide the non-icon text with a `.srOnly` utility class (added once to each `.module.css`, standard clip-based hidden-but-readable pattern) instead of removing it from the DOM:

```css
.srOnly {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- Sync status: wrap the "Synced "/"Refresh failed " words in `.srOnly` at that breakpoint, leaving only the `✓`/`✗` glyph visible. The timestamp itself is also wrapped in `.srOnly` on mobile (dropped visually, per approved design — icon-only).
- Refresh button: wrap the literal text `Refresh` in `.srOnly`, keep the `↻` glyph visible, and add `aria-label="Refresh"` to the `<button>` so its accessible name doesn't depend on visually-hidden text. Shrink the button to an icon-sized square (`padding: 4px 6px` or similar — tight but ≥32px touch target with existing font-size) at this breakpoint only.

The `flex-wrap`/`margin-left: auto` fallback added previously stays as-is — with icon-only controls it should rarely trigger except for match detail's long `Match #<id>` title, which is exactly the case it's there for.

## 2. Full team name via tap/hover (match detail scoreHeader only)

`app/match/[id]/MatchDetailClient.tsx`, the two `<span className={styles.teamName}>` in `.scoreHeader` — team names truncate with ellipsis (`.teamName` already has `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) and there's currently no way to see the full name on a narrow screen.

Change each `<span className={styles.teamName}>` to a `<button type="button" className={styles.teamName}>`, containing the (possibly-truncated) name plus a nested tooltip:

```tsx
<button type="button" className={styles.teamName}>
  {displayTeamName(homeComp?.team?.displayName || '')}
  <span className={styles.teamNameTooltip}>{homeComp?.team?.displayName}</span>
</button>
```

CSS (`page.module.css`):
```css
.teamName {
  /* existing rules unchanged, plus: */
  position: relative;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.teamNameTooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 4px;
  padding: 4px 8px;
  background: var(--mu-black);
  border: 1px solid rgba(201, 162, 39, 0.4);
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.teamName:hover .teamNameTooltip,
.teamName:focus .teamNameTooltip {
  visibility: visible;
  opacity: 1;
}
```

No React state needed: tapping a `<button>` on a touchscreen moves focus to it (standard mobile browser behavior), which triggers `:focus` and shows the tooltip; tapping elsewhere blurs it, hiding it again. `:hover` covers desktop for free. Screen readers already read the full name from the visible text node regardless of visual truncation — the tooltip is a sighted-user affordance only, not an accessibility fix.

The away side's tooltip should open leftward instead of centered/right, since it sits at the right edge of the screen — use `right: 0; left: auto; transform: none;` on the away `teamName` (a second class, e.g. `.teamNameAway`, or a data attribute) to keep it on-screen. Reuses the existing `scoreHeader .teamBlock:last-child` right-alignment pattern already in the CSS.

## 3. Goal/assist badges on the formation pitch

Currently `FormationPitch` renders a jersey circle + short name per starter, with no indication of who scored or assisted.

**Data (`lib/types.ts`):** add `id?: string` to the `athlete` object on both `EspnScoringDetail.participants[].athlete` and `EspnRosterPlayer.athlete` — ESPN's real API always includes it, matching by id is exact (no name-formatting mismatches).

**Extraction (`lib/merge.ts`):** new pure function alongside `extractScorers`:

```ts
export interface GoalContribution { goals: number; assists: number }

// Verified against live ESPN data (event 740604, 740621): a goal's `participants[1]`
// is the assist provider when the goal was assisted (cross, through ball, etc.) and
// simply absent for penalties, own goals, and unassisted efforts — never a placeholder.
export function extractGoalContributions(detail: EspnDetail): Record<string, GoalContribution> {
  const details = detail.header?.competitions?.[0]?.details || [];
  const result: Record<string, GoalContribution> = {};
  const bump = (id: string | undefined, field: 'goals' | 'assists') => {
    if (!id) return;
    result[id] = result[id] || { goals: 0, assists: 0 };
    result[id][field]++;
  };
  for (const d of details) {
    if (!d.scoringPlay || d.shootout || d.ownGoal) continue;
    bump(d.participants?.[0]?.athlete?.id, 'goals');
    bump(d.participants?.[1]?.athlete?.id, 'assists');
  }
  return result;
}
```

Own goals are excluded entirely (consistent with `lib/leaders.ts`'s existing own-goal exclusion) — an own goal is not credited as a "goal" to the scoring player's own tally here.

**Rendering (`components/FormationPitch.tsx`):** `MatchDetailClient` computes `extractGoalContributions(data)` once and passes it down as a `contributions: Record<string, GoalContribution>` prop to `FormationPitch`, which passes each player's entry to `PlayerNode` by looking up `player.athlete?.id`.

`PlayerNode` renders a small badge, positioned like the existing `.formationBadge` pattern (absolute, top-right corner of the circle):

```tsx
{contribution && (
  <span className={styles.contribBadge}>
    {contribution.goals > 0 && `⚽${contribution.goals > 1 ? contribution.goals : ''}`}
    {contribution.assists > 0 && `🅰️${contribution.assists > 1 ? contribution.assists : ''}`}
  </span>
)}
```

```css
.contribBadge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 8px;
  line-height: 1;
  display: flex;
  gap: 1px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
```

`.node` needs `position: relative` (currently `display: flex; flex-direction: column`) so the badge anchors to the node, not the whole pitch — change `.node` to add `position: relative`.

## 4. GK circle color (small, unrelated fix)

`PlayerNode` currently renders every MU fallback-circle player (no kit image available) in the same red (`.muCircle`), including the goalkeeper — real kits distinguish the keeper with a different color, so this reads as a mistake, not intentional branding.

Detect the keeper via `player.position?.abbreviation === 'G'` (already the convention used by `lib/formation.ts`'s own GK check). Add a `.gkCircle` class (green, using the existing `--mu-green` token) and apply it instead of `.muCircle` when the player is MU's own keeper:

```tsx
const isGk = player.position?.abbreviation === 'G';
const ringColor = isMu && isGk ? 'var(--mu-green)' : side === 'away' ? 'var(--mu-gold-bright)' : teamColor;
// ...
<span className={`${styles.circle} ${isMu ? (isGk ? styles.gkCircle : styles.muCircle) : ''}`}>
```

```css
.gkCircle {
  background: rgba(63, 174, 92, 0.25);
  border-color: var(--mu-green);
}
```

This applies whenever MU's own keeper is rendered, regardless of home/away side (MU is sometimes the away team) — the fix is about not confusing the keeper with an outfield player, not about home/away.

## Scope / non-goals

- No changes to desktop layout anywhere in this spec.
- Player-name tooltip (FormationPitch `.name` truncation) is explicitly out of scope — deferred, not needed today per user (`shortName` rarely truncates in practice).
- No assist data exists for penalties/own goals — a badge simply won't show `🅰️` for those, which is correct (there is no assist).

## Testing

- `components/PageHeading.test.tsx` / match detail's own header test: assert the visible text content of the sync status and refresh button is unchanged (still queryable via accessible name/role), only presentational hiding changes — no new test needed if `getByRole`/`getByLabelText` already used; add an assertion for `aria-label="Refresh"` if not already covered.
- `MatchDetailClient.test.tsx`: add a case with a long team name asserting the tooltip span exists in the DOM with the full untruncated name.
- `lib/merge.test.ts`: unit tests for `extractGoalContributions` — scorer only (no assist), scorer+assist, own goal excluded, penalty excluded, multiple goals by the same player (goals: 2).
- `FormationPitch.test.tsx`: a scorer/assister renders the expected badge glyph(s); a GK player renders `.gkCircle` not `.muCircle` when no kit image is present.
