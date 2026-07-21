import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMuMatches, fetchStandings, fetchSquad, FdApiError } from './fd';

const MU_FD_ID = 66;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMuMatches', () => {
  it('sends the API key as X-Auth-Token and hits /teams/66/matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ matches: [{ id: 1 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMuMatches('secret-key');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.football-data.org/v4/teams/${MU_FD_ID}/matches`,
      { headers: { 'X-Auth-Token': 'secret-key' } },
    );
    expect(result).toEqual([{ id: 1 }]);
  });

  it('returns an empty array when the response has no matches field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    expect(await fetchMuMatches('k')).toEqual([]);
  });

  it('throws FdApiError with code RATE_LIMIT on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'RATE_LIMIT' } satisfies Partial<FdApiError>);
  });

  it('throws FdApiError with code INVALID_KEY on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'INVALID_KEY' });
  });

  it('throws FdApiError with code NETWORK when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(fetchMuMatches('k')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('fetchStandings', () => {
  it('extracts the TOTAL table for the given competition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ standings: [{ type: 'TOTAL', table: [{ position: 1 }] }] }),
    }));
    expect(await fetchStandings('k', 'PL')).toEqual([{ position: 1 }]);
  });

  it('returns an empty array when there is no TOTAL entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ standings: [] }) }));
    expect(await fetchStandings('k', 'CL')).toEqual([]);
  });

  it('returns an empty array when the season has not started yet, even if the table has rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        season: { startDate: '2099-08-21' },
        standings: [{ type: 'TOTAL', table: [{ position: 1, playedGames: 38 }] }],
      }),
    }));
    expect(await fetchStandings('k', 'PL')).toEqual([]);
  });

  it('returns the table when the season has already started', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        season: { startDate: '2020-08-21' },
        standings: [{ type: 'TOTAL', table: [{ position: 1, playedGames: 8 }] }],
      }),
    }));
    expect(await fetchStandings('k', 'PL')).toEqual([{ position: 1, playedGames: 8 }]);
  });
});

describe('fetchSquad', () => {
  it('sends the API key as X-Auth-Token and hits /teams/66, returning the squad array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ squad: [{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSquad('secret-key');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.football-data.org/v4/teams/${MU_FD_ID}`,
      { headers: { 'X-Auth-Token': 'secret-key' } },
    );
    expect(result).toEqual([{ name: 'Bruno Fernandes', position: 'Midfield', dateOfBirth: '1994-09-08', nationality: 'Portugal' }]);
  });

  it('returns an empty array when the response has no squad field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    expect(await fetchSquad('k')).toEqual([]);
  });
});
