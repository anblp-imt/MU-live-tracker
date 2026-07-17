import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEspnSchedule, fetchEspnDetail } from './espn';

const MU_ESPN_ID = 360;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchEspnSchedule', () => {
  it('hits the per-team schedule endpoint for the given league slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [{ id: 'e1' }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchEspnSchedule('eng.1');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/${MU_ESPN_ID}/schedule`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    expect(result).toEqual([{ id: 'e1' }]);
  });

  it('returns an empty array when the league has no fixtures yet (verified real ESPN behavior pre-season)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));
    expect(await fetchEspnSchedule('club.friendly')).toEqual([]);
  });

  it('throws when ESPN returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchEspnSchedule('eng.1')).rejects.toThrow('ESPN HTTP 500');
  });

  it('throws when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(fetchEspnSchedule('eng.1')).rejects.toThrow(/network/i);
  });
});

describe('fetchEspnDetail', () => {
  it('hits the per-league summary endpoint with the event id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ header: { competitions: [] } }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEspnDetail('eng.1', '740966');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=740966',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
  });
});
