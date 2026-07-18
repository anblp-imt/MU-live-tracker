import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeading } from './PageHeading';

describe('PageHeading', () => {
  it('renders the title as an h1', () => {
    render(<PageHeading title="Today" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('renders the retro kicker line with a date', () => {
    render(<PageHeading title="Today" />);
    expect(screen.getByText(/Matchday Programme/)).toBeInTheDocument();
  });
});
