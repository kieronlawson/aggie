import * as R from "ramda";

type CanonicalCandidate = {
  url: string;
  published_at: string;
};

type CanonicalSelection = {
  canonicalUrl: string;
  mergedUrls: string[];
};

const hostOf = (url: string): string => {
  const parsed = URL.parse(url);
  return parsed === null ? "" : parsed.hostname;
};

/** True when the URL's host is the domain itself or a subdomain of it. */
const isOriginatingDomain = (url: string, originatingDomains: string[]): boolean => {
  const host = hostOf(url);
  return R.any((domain) => host === domain || host.endsWith(`.${domain}`), originatingDomains);
};

const publishedMs = (candidate: CanonicalCandidate): number => {
  const ms = Date.parse(candidate.published_at);
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
};

/**
 * Layer-3 dedupe: on merge, keep the copy from the originating domain
 * (regulator or company newsroom) over syndicators, falling back to the
 * earliest published_at. Reports link the canonical URL first.
 */
const selectCanonical = (candidates: CanonicalCandidate[], originatingDomains: string[]): CanonicalSelection => {
  const ranked = R.sortWith<CanonicalCandidate>(
    [
      R.descend((candidate) => (isOriginatingDomain(candidate.url, originatingDomains) ? 1 : 0)),
      R.ascend(publishedMs)
    ],
    candidates
  );
  const canonical = ranked[0];
  if (canonical === undefined) {
    throw new Error("selectCanonical called with no candidates");
  }
  return {
    canonicalUrl: canonical.url,
    mergedUrls: R.map(
      (candidate: CanonicalCandidate) => candidate.url,
      R.reject((c: CanonicalCandidate) => c.url === canonical.url, candidates)
    )
  };
};

export { type CanonicalCandidate, isOriginatingDomain, selectCanonical };
