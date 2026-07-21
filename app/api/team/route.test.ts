import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fd', () => ({ fetchSquad: vi.fn() }));
vi.mock('@/lib/espn', () => ({ fetchEspnRoster: vi.fn() }));

import { fetchSquad } from '@/lib/fd';
import { fetchEspnRoster } from '@/lib/espn';
import { clearCache } from '@/lib/cache';
import { GET } from './route';

const mockFetchSquad = vi.mocked(fetchSquad);
const mockFetchEspnRoster = vi.mocked(fetchEspnRoster);

beforeEach(() => {
  clearCache();
  vi.resetAllMocks();
});

describe('GET /api/team', () => {
  it('merges football-data squad with ESPN jersey numbers into grouped players', async () => {
    mockFetchSquad.mockResolvedValue([{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }]);
    mockFetchEspnRoster.mockResolvedValue({ athletes: [{ displayName: 'Bruno Fernandes', jersey: '8' }] });

    const res = await GET();
    const body = await res.json();

    expect(body.groups.find((g: { label: string }) => g.label === 'Midfielders').players).toEqual([
      { name: 'Bruno Fernandes', jersey: 8 },
    ]);
  });

  it('serves the second call from cache without calling fetchSquad again', async () => {
    mockFetchSquad.mockResolvedValue([]);
    mockFetchEspnRoster.mockResolvedValue({ athletes: [] });

    await GET();
    await GET();

    expect(mockFetchSquad).toHaveBeenCalledTimes(1);
  });
});
