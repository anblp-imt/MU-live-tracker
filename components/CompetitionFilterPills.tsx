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
