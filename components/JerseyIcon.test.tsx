import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JerseyIcon } from './JerseyIcon';

describe('JerseyIcon', () => {
  it('shows the squad number when present', () => {
    render(<JerseyIcon jersey={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows a dash placeholder when jersey is null', () => {
    render(<JerseyIcon jersey={null} />);
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('explains the dash placeholder to screen readers and mouse hover, instead of leaving it ambiguous', () => {
    render(<JerseyIcon jersey={null} />);
    expect(screen.getByLabelText('Squad number not yet confirmed')).toBeInTheDocument();
  });

  it('does not add that label when a real jersey number is present', () => {
    render(<JerseyIcon jersey={8} />);
    expect(screen.queryByLabelText('Squad number not yet confirmed')).not.toBeInTheDocument();
  });
});
