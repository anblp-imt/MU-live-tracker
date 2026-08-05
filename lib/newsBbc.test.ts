import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchBbcNews } from './newsBbc';

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_BBC_XML = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Manchester United]]></title>
<description><![CDATA[Fraizer Campbell on United's attacking options and whether a new forward is a priority.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/p0p20nb9?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.co.uk/sport/football/articles/p0p20nb9#0</guid>
<pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/images/ic/240x135/p0p20njc.jpg"/>
</item>
<item>
<title><![CDATA[Manchester United]]></title>
<description><![CDATA[Fraizer Campbell and United fans have their say on Mason Mount and the midfield revamp.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/p0p1t1zq?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.co.uk/sport/football/articles/p0p1t1zq#0</guid>
<pubDate>Thu, 30 Jul 2026 18:48:00 GMT</pubDate>
<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/images/ic/240x135/p0p1t245.jpg"/>
</item>
</channel>
</rss>`;

const SAMPLE_BBC_XML_SINGLE_ITEM = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Manchester United]]></title>
<description><![CDATA[Only one story today.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/p0p20nb9</link>
<pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
</item>
</channel>
</rss>`;

const SAMPLE_BBC_XML_WITH_ARTICLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Audio: Fraizer Campbell on United]]></title>
<description><![CDATA[Fraizer Campbell on United's attacking options.]]></description>
<link>https://www.bbc.co.uk/sounds/play/p0p20nb9?at_medium=RSS&amp;at_campaign=rss</link>
<pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Manchester United weigh up move for new forward]]></title>
<description><![CDATA[Manchester United are exploring the market for attacking reinforcements.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/abc123</link>
<pubDate>Thu, 30 Jul 2026 18:48:00 GMT</pubDate>
</item>
</channel>
</rss>`;

describe('fetchBbcNews', () => {
  it('parses feed items into NewsArticle objects, decoding the link entity and reading the thumbnail attribute', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_BBC_XML }));

    const result = await fetchBbcNews();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: result[0].id,
      source: 'BBC',
      sourceUrl: 'https://www.bbc.co.uk/sport/football/articles/p0p20nb9?at_medium=RSS&at_campaign=rss',
      title: 'Manchester United',
      summary: "Fraizer Campbell on United's attacking options and whether a new forward is a priority.",
      imageUrl: 'https://ichef.bbci.co.uk/images/ic/976x547/p0p20njc.jpg',
      publishedAt: new Date('Fri, 31 Jul 2026 16:22:00 GMT').toISOString(),
    });
  });

  it('does not throw when the feed has exactly one item (fast-xml-parser returns an object, not an array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_BBC_XML_SINGLE_ITEM }));

    const result = await fetchBbcNews();

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Manchester United');
  });

  it('throws when the feed request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchBbcNews()).rejects.toThrow('BBC HTTP 503');
  });

  it('filters out BBC Sounds audio items, keeping only written articles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_BBC_XML_WITH_ARTICLE }));

    const result = await fetchBbcNews();

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe('https://www.bbc.co.uk/sport/football/articles/abc123');
  });

  it('filters out articles that do not mention Manchester United', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Manchester United sign new striker]]></title>
<description><![CDATA[Manchester United have completed the signing of a new forward.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/mu001</link>
<pubDate>Fri, 31 Jul 2026 10:00:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Liverpool win Premier League title]]></title>
<description><![CDATA[Liverpool have been crowned champions.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/lfc001</link>
<pubDate>Fri, 31 Jul 2026 11:00:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Chelsea transfer news]]></title>
<description><![CDATA[Chelsea are looking at a new deal.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/cfc001</link>
<pubDate>Fri, 31 Jul 2026 12:00:00 GMT</pubDate>
</item>
</channel>
</rss>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => xml }));

    const result = await fetchBbcNews();

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Manchester United sign new striker');
  });

  it('filters out articles about the women\'s team', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Man Utd set to appoint ex-Hearts boss Olid as women's manager]]></title>
<description><![CDATA[Manchester United are set to appoint former Hearts boss Eva Olid as their women's manager.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/wsl001</link>
<pubDate>Fri, 31 Jul 2026 10:00:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Man Utd's George closing in on Brighton move]]></title>
<description><![CDATA[Manchester United defender Gabby George is closing in on a move to Brighton before the start of the WSL season.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/wsl002</link>
<pubDate>Fri, 31 Jul 2026 11:00:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Man Utd admit ticket touting investigation error]]></title>
<description><![CDATA[Manchester United admit making mistakes in the execution of their ticket touting investigation.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/men001</link>
<pubDate>Fri, 31 Jul 2026 12:00:00 GMT</pubDate>
</item>
</channel>
</rss>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => xml }));

    const result = await fetchBbcNews();

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Man Utd admit ticket touting investigation error');
  });

  it('enhances ace/standard thumbnail URLs to high resolution', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title><![CDATA[BBC Sport]]></title>
<item>
<title><![CDATA[Manchester United update]]></title>
<description><![CDATA[Manchester United news today.]]></description>
<link>https://www.bbc.co.uk/sport/football/articles/xyz789</link>
<pubDate>Fri, 31 Jul 2026 10:00:00 GMT</pubDate>
<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/abcd/live/1234.jpg"/>
</item>
</channel>
</rss>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => xml }));

    const result = await fetchBbcNews();

    expect(result[0].imageUrl).toBe('https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/abcd/live/1234.jpg');
  });

  it('keeps imageUrl undefined when no thumbnail is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_BBC_XML_SINGLE_ITEM }));

    const result = await fetchBbcNews();

    expect(result[0].imageUrl).toBeUndefined();
  });
});
