import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEspnNews } from './newsEspn';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchEspnNews', () => {
  it('fetches the MU-filtered news endpoint and maps articles', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: [
          {
            headline: 'Man United rally to beat Atlético Madrid with Bryan Mbeumo brace',
            description: 'United came from behind twice in Los Angeles.',
            published: '2026-08-01T22:00:00Z',
            images: [{ url: 'https://a.espncdn.com/photo/2026/0801/r1696420_1296x729_16-9.jpg' }],
            links: { web: { href: 'https://www.espn.com/soccer/story/_/id/1/man-utd-atletico' } },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchEspnNews();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?team=360',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    expect(result).toEqual([{
      id: result[0].id,
      source: 'ESPN',
      sourceUrl: 'https://www.espn.com/soccer/story/_/id/1/man-utd-atletico',
      title: 'Man United rally to beat Atlético Madrid with Bryan Mbeumo brace',
      summary: 'United came from behind twice in Los Angeles.',
      imageUrl: 'https://a.espncdn.com/photo/2026/0801/r1696420_1296x729_16-9.jpg',
      publishedAt: '2026-08-01T22:00:00.000Z',
    }]);
  });

  it('skips articles missing a web link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ articles: [{ headline: 'No link', description: '', published: '2026-08-01T00:00:00Z', links: {} }] }),
    }));

    expect(await fetchEspnNews()).toEqual([]);
  });

  it('throws when the endpoint request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchEspnNews()).rejects.toThrow('ESPN HTTP 503');
  });
});
