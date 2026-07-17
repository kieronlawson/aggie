export const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>SEC Press Releases</title>
    <item>
      <title>SEC Charges Adviser With Recordkeeping Failures</title>
      <link>https://www.sec.gov/newsroom/press-releases/2026-102</link>
      <description>&lt;p&gt;The Securities and Exchange Commission today announced charges.&lt;/p&gt;</description>
      <pubDate>Tue, 14 Jul 2026 14:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Item</title>
      <link>https://www.sec.gov/newsroom/press-releases/2026-103</link>
      <description><![CDATA[<p>Body two</p>]]></description>
      <pubDate>Wed, 15 Jul 2026 10:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

export const ATOM_FIXTURE = `<?xml version="1.0" encoding="ISO-8859-1" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>EDGAR filings for RingCentral</title>
  <entry>
    <title>10-Q - Quarterly report</title>
    <link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/edgar/data/1384905/000138490526000042-index.htm"/>
    <summary type="html">Quarterly report for the period ending June 30, 2026</summary>
    <updated>2026-07-10T16:03:21-04:00</updated>
    <id>urn:tag:sec.gov,2008:accession-number=0001384905-26-000042</id>
  </entry>
</feed>`;
