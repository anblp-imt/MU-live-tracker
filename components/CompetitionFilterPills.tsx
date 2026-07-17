import type { CompetitionId } from '@/lib/types';
import { COMPETITIONS } from '@/lib/competitions';

export type FilterValue = CompetitionId | 'ALL';

// [React] This component holds no useState — it's fully "controlled" by its parent via
// `selected`/`onSelect` props. That's what makes lifting state up possible: the parent
// (or later, a Context provider) owns the one source of truth, and every consumer of it
// re-renders in sync automatically.
export function CompetitionFilterPills({ selected, onSelect }: { selected: FilterValue; onSelect: (value: FilterValue) => void }) {
  return (
    <div role="tablist" aria-label="Filter by competition">
      <button role="tab" aria-selected={selected === 'ALL'} onClick={() => onSelect('ALL')}>All</button>
      {COMPETITIONS.map(c => (
        <button key={c.id} role="tab" aria-selected={selected === c.id} onClick={() => onSelect(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
