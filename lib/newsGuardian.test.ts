import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGuardianNews } from './newsGuardian';

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_GUARDIAN_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
<channel>
<title>Manchester United | The Guardian</title>
<item>
<title>The five big beasts are gone: who will be the Premier League's next alpha manager?</title>
<link>https://www.theguardian.com/football/2026/aug/02/premier-league-managers-arteta-alonso-de-zerbi-carrick-klopp-guardiola</link>
<description>&lt;p&gt;Arsenal's Mikel Arteta is perhaps best placed to fill the void.&lt;/p&gt;&lt;p&gt;Next season will be&amp;nbsp;different this time.&lt;/p&gt; &lt;a href="https://www.theguardian.com/football/2026/aug/02/story"&gt;Continue reading...&lt;/a&gt;</description>
<pubDate>Sun, 02 Aug 2026 07:00:15 GMT</pubDate>
<guid>https://www.theguardian.com/football/2026/aug/02/premier-league-managers-arteta-alonso-de-zerbi-carrick-klopp-guardiola</guid>
<media:content width="140" url="https://i.guim.co.uk/img/media/example/140.jpg"><media:credit scheme="urn:ebu">Composite: Getty Images</media:credit></media:content>
<media:content width="700" url="https://i.guim.co.uk/img/media/example/700.jpg"><media:credit scheme="urn:ebu">Composite: Getty Images</media:credit></media:content>
<dc:creator>Jonathan Wilson</dc:creator>
<dc:date>2026-08-02T07:00:15Z</dc:date>
</item>
</channel>
</rss>`;

describe('fetchGuardianNews', () => {
  it('strips HTML and the trailing "Continue reading..." link from the description, picks the widest image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_GUARDIAN_XML }));

    const result = await fetchGuardianNews();

    expect(result).toEqual([{
      id: result[0].id,
      source: 'Guardian',
      sourceUrl: 'https://www.theguardian.com/football/2026/aug/02/premier-league-managers-arteta-alonso-de-zerbi-carrick-klopp-guardiola',
      title: "The five big beasts are gone: who will be the Premier League's next alpha manager?",
      summary: "Arsenal's Mikel Arteta is perhaps best placed to fill the void. Next season will be different this time.",
      imageUrl: 'https://i.guim.co.uk/img/media/example/700.jpg',
      publishedAt: new Date('Sun, 02 Aug 2026 07:00:15 GMT').toISOString(),
    }]);
  });

  it('omits imageUrl when an item has no media:content', async () => {
    const xmlNoImage = SAMPLE_GUARDIAN_XML.replace(
      /<media:content[^>]*>.*?<\/media:content>\s*<media:content[^>]*>.*?<\/media:content>/s,
      '',
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => xmlNoImage }));

    const result = await fetchGuardianNews();

    expect(result[0].imageUrl).toBeUndefined();
  });

  it('throws when the feed request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchGuardianNews()).rejects.toThrow('Guardian HTTP 503');
  });
});
