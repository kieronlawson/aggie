const SYNDICATOR_HOSTS: readonly string[] = [
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "newswire.com",
  "accesswire.com",
  "finance.yahoo.com",
  "news.yahoo.com",
  "marketwatch.com",
  "benzinga.com",
  "seekingalpha.com",
  "streetinsider.com",
  "stocktitan.net",
  "morningstar.com",
  "nasdaq.com",
  "msn.com",
  "apnews.com",
  "markets.businessinsider.com",
  "news.google.com"
];

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const isSyndicator = (url: string): boolean => {
  const host = hostOf(url);
  return SYNDICATOR_HOSTS.some((syndicator) => host === syndicator || host.endsWith(`.${syndicator}`));
};

export type UrlCopy = { url: string; publishedAt: number };

// Layer-3 rule from spec §P: prefer the originating domain over syndicators,
// falling back to earliest published_at.
export const pickCanonical = (a: UrlCopy, b: UrlCopy): UrlCopy => {
  const aSyndicated = isSyndicator(a.url);
  const bSyndicated = isSyndicator(b.url);
  if (aSyndicated !== bSyndicated) {
    return aSyndicated ? b : a;
  }
  return b.publishedAt < a.publishedAt ? b : a;
};
