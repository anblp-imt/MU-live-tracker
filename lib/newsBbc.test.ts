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
<link>https://www.bbc.co.uk/sounds/play/p0p20nb9?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.co.uk/sounds/play/p0p20nb9#0</guid>
<pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/images/ic/240x135/p0p20njc.jpg"/>
</item>
<item>
<title><![CDATA[Manchester United]]></title>
<description><![CDATA[Fraizer Campbell and United fans have their say on Mason Mount and the midfield revamp.]]></description>
<link>https://www.bbc.co.uk/sounds/play/p0p1t1zq?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.co.uk/sounds/play/p0p1t1zq#0</guid>
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
<link>https://www.bbc.co.uk/sounds/play/p0p20nb9</link>
<pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
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
      sourceUrl: 'https://www.bbc.co.uk/sounds/play/p0p20nb9?at_medium=RSS&at_campaign=rss',
      title: 'Manchester United',
      summary: "Fraizer Campbell on United's attacking options and whether a new forward is a priority.",
      imageUrl: 'https://ichef.bbci.co.uk/images/ic/240x135/p0p20njc.jpg',
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
});
