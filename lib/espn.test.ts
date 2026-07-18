import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEspnSchedule, fetchEspnDetail } from './espn';
import type { EspnScheduleEvent } from './types';

const MU_ESPN_ID = 360;

afterEach(() => {
  vi.unstubAllGlobals();
});

function event(id: string, competitorIds: string[]): EspnScheduleEvent {
  return {
    id,
    date: '2026-08-22T11:30Z',
    competitions: [{
      competitors: competitorIds.map((tid, i) => ({
        homeAway: i === 0 ? 'home' : 'away',
        team: { id: tid, displayName: `Team ${tid}` },
      })),
      status: { type: { state: 'pre' } },
    }],
  };
}

describe('fetchEspnSchedule', () => {
  it('hits the date-range scoreboard endpoint for the given league slug, spanning the season from `now`', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    // now = 2026-07-18 -> season 2026-07-01 .. 2027-06-30 (July counts as next season, per lib/season.ts)
    await fetchEspnSchedule('eng.1', new Date('2026-07-18T00:00:00Z'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260701-20270630&limit=500',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
  });

  it('uses the previous year as season start when `now` is before July', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEspnSchedule('eng.1', new Date('2027-03-01T00:00:00Z'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260701-20270630&limit=500',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
  });

  it('filters the scoreboard (all teams in the competition) down to only Manchester United fixtures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          event('mu-home', [String(MU_ESPN_ID), '331']),
          event('other-match', ['331', '359']),
          event('mu-away', ['331', String(MU_ESPN_ID)]),
        ],
      }),
    }));

    const result = await fetchEspnSchedule('eng.1');

    expect(result.map(e => e.id)).toEqual(['mu-home', 'mu-away']);
  });

  it('returns an empty array when the scoreboard has no fixtures for this slug/range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));
    expect(await fetchEspnSchedule('eng.fa')).toEqual([]);
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
