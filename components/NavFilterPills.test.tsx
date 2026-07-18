import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavFilterPills } from './NavFilterPills';
import { CompetitionFilterProvider } from '@/contexts/CompetitionFilterContext';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('NavFilterPills', () => {
  it('renders the shared filter pills on Today', () => {
    mockPathname = '/';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders the shared filter pills on Schedule', () => {
    mockPathname = '/schedule';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders nothing on Standings — that page has its own competition tabs', () => {
    mockPathname = '/standings';
    render(<CompetitionFilterProvider><NavFilterPills /></CompetitionFilterProvider>);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
