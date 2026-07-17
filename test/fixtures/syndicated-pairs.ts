// Syndicated-duplicate pairs modeled on real announcement flows: the same
// wire text as it appears on the originating site vs. a syndicator, with the
// markup, whitespace and entity differences syndication introduces.
// Pair bodies are verbatim-identical text (layer-1 hash territory); the
// press-release-inside-article case adds reporter framing (layer-2 territory).

export type SyndicatedPair = {
  name: string;
  originUrl: string;
  originHtml: string;
  syndicatedUrl: string;
  syndicatedHtml: string;
};

const RINGCENTRAL_EARNINGS_BODY =
  "RingCentral, Inc. (NYSE: RNG), a global leader in AI-powered trusted business communications, " +
  "today announced financial results for the second quarter of 2026. Total revenue grew 9% " +
  "year over year to $630 million. Subscriptions revenue increased 10% year over year to $605 " +
  "million. \"Our AI product portfolio continues to gain traction with more than 1,000 paying " +
  "customers now using RingCX,\" said the company's chief executive officer.";

const SEC_ENFORCEMENT_BODY =
  "The Securities and Exchange Commission today announced settled charges against a registered " +
  "broker-dealer for widespread and longstanding failures to maintain and preserve electronic " +
  "communications sent and received on personal devices via unapproved messaging platforms. The " +
  "firm agreed to pay a $35 million civil penalty and has begun implementing improvements to its " +
  "compliance policies and procedures to settle the charges.";

const EIGHT_X_EIGHT_PRODUCT_BODY =
  "8x8, Inc. (NASDAQ: EGHT), a leading integrated cloud contact center and unified communications " +
  "platform provider, today announced the general availability of 8x8 Engage, an AI-powered " +
  "solution designed for cross-organization customer engagement, enabling customer-facing " +
  "employees outside the contact center to deliver differentiated experiences.";

export const SYNDICATED_PAIRS: readonly SyndicatedPair[] = [
  {
    name: "ringcentral-earnings",
    originUrl: "https://ir.ringcentral.com/news/press-releases/2026/q2-results",
    originHtml: `<article><h1>RingCentral Announces Second Quarter 2026 Results</h1><p>${RINGCENTRAL_EARNINGS_BODY}</p></article>`,
    syndicatedUrl: "https://www.businesswire.com/news/home/20260805/ringcentral-q2-results",
    syndicatedHtml: `<div class="bw-release-story">\n<h1>RingCentral Announces Second Quarter 2026 Results</h1>\n\n<p>\n${RINGCENTRAL_EARNINGS_BODY.replace(/"/g, "&quot;")}\n</p>\n</div>`
  },
  {
    name: "sec-enforcement",
    originUrl: "https://www.sec.gov/newsroom/press-releases/2026-101",
    originHtml: `<div class="press-release"><p>${SEC_ENFORCEMENT_BODY}</p></div>`,
    syndicatedUrl: "https://finance.yahoo.com/news/sec-charges-broker-dealer-recordkeeping-140000123.html",
    syndicatedHtml: `<section>  <p>${SEC_ENFORCEMENT_BODY.toUpperCase().slice(0, 0)}${SEC_ENFORCEMENT_BODY}</p>\n\n<p>&nbsp;</p></section>`
  },
  {
    name: "8x8-product-launch",
    originUrl: "https://www.8x8.com/company/news/8x8-engage-general-availability",
    originHtml: `<main><h2>8x8 Announces General Availability of 8x8 Engage</h2><p>${EIGHT_X_EIGHT_PRODUCT_BODY}</p></main>`,
    syndicatedUrl: "https://www.globenewswire.com/news-release/2026/06/12/8x8-engage-ga.html",
    syndicatedHtml: `<h2>8x8 Announces General Availability of 8x8 Engage</h2><p class="gnw-body">${EIGHT_X_EIGHT_PRODUCT_BODY.replace(/ /g, "  ")}</p>`
  }
];

// Press release embedded inside an article with original reporting around it:
// hashes must NOT match (different normalized text) — this is the layer-2 case.
export const PRESS_RELEASE_INSIDE_ARTICLE = {
  pressReleaseUrl: "https://www.globenewswire.com/news-release/2026/06/12/8x8-engage-ga.html",
  pressReleaseHtml: `<p>${EIGHT_X_EIGHT_PRODUCT_BODY}</p>`,
  articleUrl: "https://www.uctoday.com/contact-center/8x8-launches-engage/",
  articleHtml:
    "<article><p>8x8 is making another push beyond the contact center. In an announcement on " +
    `Thursday, the vendor said its new Engage product is now generally available.</p><p>${EIGHT_X_EIGHT_PRODUCT_BODY}</p>` +
    "<p>Analysts said the move puts pressure on rivals like RingCentral and Aircall to respond " +
    "with their own offerings for non-contact-center staff.</p></article>"
};
