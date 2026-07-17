import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompetitionFilterPills } from './CompetitionFilterPills';

describe('CompetitionFilterPills', () => {
  it('renders an All tab plus one per competition', () => {
    render(<CompetitionFilterPills selected="ALL" onSelect={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(6); // All + PL + CL + FA + EFL + Friendly
  });

  it('marks the selected tab as aria-selected', () => {
    render(<CompetitionFilterPills selected="PL" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Premier League' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect with the clicked competition id, not internal state', async () => {
    const onSelect = vi.fn();
    render(<CompetitionFilterPills selected="ALL" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Premier League' }));
    expect(onSelect).toHaveBeenCalledWith('PL');
  });
});
