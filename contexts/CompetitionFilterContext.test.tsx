import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompetitionFilterProvider, useCompetitionFilter } from './CompetitionFilterContext';

function ReaderA() {
  const { selected } = useCompetitionFilter();
  return <span data-testid="reader-a">{selected}</span>;
}

function WriterB() {
  const { setSelected } = useCompetitionFilter();
  return <button onClick={() => setSelected('CL')}>set CL</button>;
}

describe('CompetitionFilterContext', () => {
  it('starts at ALL', () => {
    render(<CompetitionFilterProvider><ReaderA /></CompetitionFilterProvider>);
    expect(screen.getByTestId('reader-a')).toHaveTextContent('ALL');
  });

  it('lets one consumer\'s update be seen by a sibling consumer, without any prop passed between them', async () => {
    render(
      <CompetitionFilterProvider>
        <ReaderA />
        <WriterB />
      </CompetitionFilterProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'set CL' }));
    expect(screen.getByTestId('reader-a')).toHaveTextContent('CL');
  });

  it('throws if useCompetitionFilter is called outside the provider', () => {
    function Bare() {
      useCompetitionFilter();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/CompetitionFilterProvider/);
  });
});
