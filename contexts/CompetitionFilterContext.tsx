'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { FilterValue } from '@/components/CompetitionFilterPills';

interface CompetitionFilterContextValue {
  selected: FilterValue;
  setSelected: (value: FilterValue) => void;
}

const CompetitionFilterContext = createContext<CompetitionFilterContextValue | null>(null);

export function CompetitionFilterProvider({ children }: { children: ReactNode }) {
  // [React] The Provider owns the one piece of state; every consumer below it in the
  // tree reads the same value via useContext and re-renders when it changes — no props
  // threaded through layout.tsx or any intermediate component.
  const [selected, setSelected] = useState<FilterValue>('ALL');
  return (
    <CompetitionFilterContext.Provider value={{ selected, setSelected }}>
      {children}
    </CompetitionFilterContext.Provider>
  );
}

export function useCompetitionFilter(): CompetitionFilterContextValue {
  const ctx = useContext(CompetitionFilterContext);
  if (!ctx) throw new Error('useCompetitionFilter must be used within CompetitionFilterProvider');
  return ctx;
}
