import type { Competitor, Source } from "./types.js";

const competitorLine = (competitor: Competitor): string =>
  `| ${competitor.name} | ${competitor.relationship} | ${competitor.aliases.join(", ")} | ${competitor.active ? "yes" : "no"} |`;

const sourceLine = (source: Source): string =>
  `| ${source.kind} | ${source.vertical} | ${source.competitor === "" ? "—" : source.competitor} | ${source.url} | ${source.cadence} | ${source.active ? "yes" : "no"} |`;

export const exportMarkdown = (
  competitors: readonly Competitor[],
  sources: readonly Source[]
): string =>
  [
    "# Aggie source registry",
    "",
    "Generated from the TurboPuffer `registry` namespace. Edit via the W0 workflow, not this file.",
    "",
    "## Competitors",
    "",
    "| Name | Relationship | Aliases | Active |",
    "|---|---|---|---|",
    ...competitors.map(competitorLine),
    "",
    "## Sources",
    "",
    "| Kind | Vertical | Competitor | URL | Cadence | Active |",
    "|---|---|---|---|---|---|",
    ...sources.map(sourceLine),
    ""
  ].join("\n");
