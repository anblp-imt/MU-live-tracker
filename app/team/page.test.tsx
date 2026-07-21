import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeamPage from './page';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockTeamResponse(groups: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ groups }),
  }));
}

describe('TeamPage', () => {
  it('renders all four position group headings with player counts', async () => {
    mockTeamResponse([
      { label: 'Goalkeepers', players: [{ name: 'Altay Bayindir', jersey: 1 }] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByTestId('group-Goalkeepers')).toBeInTheDocument());
    expect(screen.getByTestId('group-Goalkeepers')).toHaveTextContent('Goalkeepers 1');
    expect(screen.getByTestId('group-Defenders')).toHaveTextContent('Defenders 0');
    expect(screen.getByTestId('group-Midfielders')).toHaveTextContent('Midfielders 0');
    expect(screen.getByTestId('group-Forwards')).toHaveTextContent('Forwards 0');
  });

  it('renders a jersey number and the player name for a numbered player', async () => {
    // jersey: 7 is deliberately distinct from every group's player count (which would
    // otherwise render as its own "0"/"1" text node and collide with getByText below).
    mockTeamResponse([
      { label: 'Goalkeepers', players: [{ name: 'Altay Bayindir', jersey: 7 }] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByText('Bayindir')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Altay')).toBeInTheDocument();
  });

  it('renders a dash placeholder for a player with no jersey number', async () => {
    mockTeamResponse([
      { label: 'Goalkeepers', players: [] },
      { label: 'Defenders', players: [] },
      { label: 'Midfielders', players: [{ name: 'Andrey Santos', jersey: null }] },
      { label: 'Forwards', players: [] },
    ]);

    render(<TeamPage />);

    await waitFor(() => expect(screen.getByText('Santos')).toBeInTheDocument());
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});
