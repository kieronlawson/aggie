import * as R from "ramda";

/** Slack renders best under ~4000 chars per message; leave headroom. */
const SLACK_CHUNK_LIMIT = 3800;

/**
 * Converts the digest's GitHub-flavored markdown to Slack mrkdwn: headings
 * become bold lines, `**bold**` becomes `*bold*`, `[text](url)` becomes
 * `<url|text>`, and `-` bullets become `•`.
 */
const toMrkdwn = (markdown: string): string =>
  markdown
    .replace(/^#{1,6}\s+(.+)$/gmu, "*$1*")
    .replace(/\*\*([^*]+)\*\*/gu, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gu, "<$2|$1>")
    .replace(/^-\s+/gmu, "• ");

const hardSplit = (text: string): string[] => {
  if (text.length <= SLACK_CHUNK_LIMIT) {
    return [text];
  }
  const breakAt = text.lastIndexOf("\n", SLACK_CHUNK_LIMIT);
  const splitAt = breakAt > 0 ? breakAt : SLACK_CHUNK_LIMIT;
  return [text.slice(0, splitAt), ...hardSplit(text.slice(splitAt).trimStart())];
};

const SECTION_SEPARATOR_LENGTH = 2;

const appendSection = (chunks: string[], section: string): string[] => {
  const last = chunks[chunks.length - 1];
  if (last !== undefined && last.length + section.length + SECTION_SEPARATOR_LENGTH <= SLACK_CHUNK_LIMIT) {
    return [...chunks.slice(0, -1), `${last}\n\n${section}`];
  }
  return [...chunks, ...hardSplit(section)];
};

/** Splits mrkdwn text into Slack-sized chunks, preferring section boundaries. */
const chunkForSlack = (text: string): string[] => {
  const sections = text.split(/\n{2,}(?=\*[^*\n]+\*\n)/u);
  return R.reduce(appendSection, [], R.chain(hardSplit, sections));
};

export { chunkForSlack, SLACK_CHUNK_LIMIT, toMrkdwn };
