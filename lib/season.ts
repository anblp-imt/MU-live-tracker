// European club season runs Aug→May, so July counts as the start of the *upcoming*
// season (pre-season). Heuristic from HANDOFF.md section 2; football-data.org's own
// season-less endpoint is the primary source of truth for which fixtures show up, this
// label is only used for display (e.g. "2026-27" in the season header).
export function currentSeasonLabel(now: Date = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 7 ? year : year - 1;
  const endYy = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYy}`;
}
