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

export { toMrkdwn };
