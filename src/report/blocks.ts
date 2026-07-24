import * as R from "ramda";

import { type SlackBlock } from "#src/clients/slack.ts";
import { toMrkdwn } from "#src/report/mrkdwn.ts";

/** Under the tightest Block Kit text cap (context elements: 2000 chars). */
const BLOCK_TEXT_LIMIT = 1900;
const HEADER_TEXT_LIMIT = 150;
const BUTTON_LABEL_LIMIT = 75;
const FALLBACK_TEXT_LIMIT = 120;

const MRKDWN_TYPE = "mrkdwn";
const PLAIN_TEXT_TYPE = "plain_text";

const section = (text: string): SlackBlock => ({ type: "section", text: { type: MRKDWN_TYPE, text } });
const context = (text: string): SlackBlock => ({ type: "context", elements: [{ type: MRKDWN_TYPE, text }] });
const DIVIDER: SlackBlock = { type: "divider" };
const headerBlock = (text: string): SlackBlock => ({
  type: "header",
  text: { type: PLAIN_TEXT_TYPE, text: text.slice(0, HEADER_TEXT_LIMIT) }
});

const hardSplit = (text: string): string[] => {
  if (text.length <= BLOCK_TEXT_LIMIT) {
    return [text];
  }
  const breakAt = text.lastIndexOf("\n", BLOCK_TEXT_LIMIT);
  const splitAt = breakAt > 0 ? breakAt : BLOCK_TEXT_LIMIT;
  return [text.slice(0, splitAt), ...hardSplit(text.slice(splitAt).trimStart())];
};

/** Renders markdown as one or more section blocks, splitting under the text cap. */
const mdSections = (markdown: string): SlackBlock[] => R.map(section, hardSplit(toMrkdwn(markdown)));

type DigestSection = { heading: string; body: string };

type ParsedDigest = { leadIn: string; sections: DigestSection[] };

const TOP_HEADING_PATTERN = /^## /mu;

const toDigestSection = (part: string): DigestSection => {
  const [headingLine = "", ...lines] = part.split("\n");
  return { heading: headingLine.trim(), body: lines.join("\n").trim() };
};

const parseDigest = (body: string): ParsedDigest => {
  const [leadIn = "", ...rest] = body.split(TOP_HEADING_PATTERN);
  return { leadIn: leadIn.trim(), sections: R.map(toDigestSection, rest) };
};

const SIGNALS_HEADING = "Signals";
const NEW_THIS_WEEK_HEADING = "New this week";
const DETAILS_HEADING = "Details";
const MANUAL_CHECKS_HEADING = "Manual checks";
const FOOTER_HEADING = "Footer";

const hasHeading = (name: string): ((digestSection: DigestSection) => boolean) =>
  (digestSection: DigestSection): boolean => digestSection.heading.includes(name);

const LINK_PATTERN = /\[([^\]]+)\]\((https?:[^)\s]+)\)/gu;

type MdLink = { label: string; url: string };

const allLinks = (text: string): MdLink[] =>
  R.map(([, label = "", url = ""]) => ({ label, url }), [...text.matchAll(LINK_PATTERN)]);

const mrkdwnLink = (link: MdLink): string => `<${link.url}|${link.label}>`;

const BULLET_PREFIX = "- ";

const bulletLines = (body: string): string[] =>
  R.pipe(
    (text: string) => text.split("\n"),
    R.filter((line: string) => line.startsWith(BULLET_PREFIX)),
    R.map((line: string) => line.slice(BULLET_PREFIX.length).trim())
  )(body);

const TRAILING_SEPARATOR_PATTERN = /\s+[.—–-]?\s*$/u;

/** A signal's trailing story link becomes a URL button — no interactivity endpoint needed. */
const signalBlock = (bullet: string): SlackBlock => {
  const link = R.last(allLinks(bullet));
  if (link === undefined) {
    return section(toMrkdwn(bullet));
  }
  const text = bullet
    .replace(`[${link.label}](${link.url})`, "")
    .replace(TRAILING_SEPARATOR_PATTERN, "");
  return {
    ...section(toMrkdwn(text)),
    accessory: {
      type: "button",
      text: { type: PLAIN_TEXT_TYPE, text: `${link.label} →`.slice(0, BUTTON_LABEL_LIMIT) },
      url: link.url
    }
  };
};

const WHY_LINE_PATTERN = /_Why it matters —[\s\S]+_$/u;
const CITATION_GROUP_PATTERN =
  /\s*\((\[[^\]]+\]\(https?:[^)\s]+\)(?:[,;·\s]+\[[^\]]+\]\(https?:[^)\s]+\))*)\)/gu;
const ITALIC_EDGE_LENGTH = 1;
const SOURCE_PREFIX = "🔗 ";
const SOURCE_SEPARATOR = " · ";

/** Story reply layers: summary, quiet source-link line, quiet why-it-matters line. */
const storyBlocks = (paragraph: string): SlackBlock[] => {
  const whyMatch = WHY_LINE_PATTERN.exec(paragraph);
  const why = whyMatch === null ? "" : whyMatch[0].slice(ITALIC_EDGE_LENGTH, -ITALIC_EDGE_LENGTH);
  const cited = paragraph.replace(WHY_LINE_PATTERN, "").trim();
  const citations = R.chain((group) => allLinks(group[1] ?? ""), [...cited.matchAll(CITATION_GROUP_PATTERN)]);
  const sourceLine =
    citations.length === 0 ? [] : [context(`${SOURCE_PREFIX}${R.map(mrkdwnLink, citations).join(SOURCE_SEPARATOR)}`)];
  const whyLine = why.length === 0 ? [] : [context(toMrkdwn(why))];
  return [...mdSections(cited.replace(CITATION_GROUP_PATTERN, "").trim()), ...sourceLine, ...whyLine];
};

type DigestCounts = {
  items: number;
  clusters: number;
};

type DigestMeta = {
  vertical: string;
  reportDate: string;
  counts: DigestCounts | undefined;
};

type BlockMessage = {
  text: string;
  blocks: SlackBlock[];
};

const CARD_POINTER = "🧵 Full digest in thread →";

const countsContext = (counts: DigestCounts | undefined): SlackBlock[] =>
  counts === undefined ? [] : [context(`📡 ${String(counts.items)} items · ${String(counts.clusters)} stories`)];

const capitalize = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

const labeledBlocks = (
  digestSection: DigestSection | undefined,
  render: (body: string) => SlackBlock[]
): SlackBlock[] =>
  digestSection === undefined
    ? []
    : [DIVIDER, context(digestSection.heading.toUpperCase()), ...render(digestSection.body)];

const cardMessage = (meta: DigestMeta, parsed: ParsedDigest): BlockMessage => {
  const headerText = `Aggie — ${capitalize(meta.vertical)} · week of ${meta.reportDate}`;
  const signals = R.find(hasHeading(SIGNALS_HEADING), parsed.sections);
  const fresh = R.find(hasHeading(NEW_THIS_WEEK_HEADING), parsed.sections);
  return {
    text: headerText,
    blocks: [
      headerBlock(headerText),
      ...countsContext(meta.counts),
      ...(parsed.leadIn.length === 0 ? [] : mdSections(parsed.leadIn)),
      ...labeledBlocks(signals, (body) => R.map(signalBlock, bulletLines(body))),
      ...labeledBlocks(fresh, mdSections),
      context(CARD_POINTER)
    ]
  };
};

const fallbackText = (markdown: string): string =>
  markdown.replace(LINK_PATTERN, "$1").replace(/[*_#]/gu, "").trim().slice(0, FALLBACK_TEXT_LIMIT);

const PARAGRAPH_SPLIT_PATTERN = /\n{2,}/u;

const paragraphs = (body: string): string[] =>
  R.filter((part: string) => part.length > 0, R.map(R.trim, body.split(PARAGRAPH_SPLIT_PATTERN)));

const storyReplies = (digestSection: DigestSection): BlockMessage[] =>
  R.map(
    (paragraph: string) => ({ text: fallbackText(paragraph), blocks: storyBlocks(paragraph) }),
    paragraphs(digestSection.body)
  );

const genericReply = (digestSection: DigestSection): BlockMessage => ({
  text: fallbackText(digestSection.heading),
  blocks: [context(digestSection.heading.toUpperCase()), ...mdSections(digestSection.body)]
});

const OPS_FALLBACK_TEXT = "Manual checks & footer";

/** Manual checks and footer collapse into one quiet context-only reply. */
const opsReply = (opsSections: DigestSection[]): BlockMessage[] =>
  opsSections.length === 0
    ? []
    : [{
      text: OPS_FALLBACK_TEXT,
      blocks: R.chain(
        (digestSection) => R.map(context, hardSplit(toMrkdwn(`*${digestSection.heading}*\n${digestSection.body}`))),
        opsSections
      )
    }];

const isOps = (digestSection: DigestSection): boolean =>
  hasHeading(MANUAL_CHECKS_HEADING)(digestSection) || hasHeading(FOOTER_HEADING)(digestSection);

const isCardSection = (digestSection: DigestSection): boolean =>
  hasHeading(SIGNALS_HEADING)(digestSection) || hasHeading(NEW_THIS_WEEK_HEADING)(digestSection);

const replyMessages = (digestSection: DigestSection): BlockMessage[] => {
  if (isCardSection(digestSection)) {
    return [];
  }
  if (hasHeading(DETAILS_HEADING)(digestSection)) {
    return storyReplies(digestSection);
  }
  return [genericReply(digestSection)];
};

type DigestMessages = {
  card: BlockMessage;
  replies: BlockMessage[];
};

/** Renders a digest body into a channel card plus ordered thread replies. */
const digestMessages = (meta: DigestMeta, body: string): DigestMessages => {
  const parsed = parseDigest(body);
  const [ops, content] = R.partition(isOps, parsed.sections);
  return {
    card: cardMessage(meta, parsed),
    replies: [...R.chain(replyMessages, content), ...opsReply(ops)]
  };
};

export { type BlockMessage, type DigestCounts, type DigestMessages, digestMessages, type DigestMeta };
