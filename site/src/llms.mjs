// /llms.txt (llmstxt.org): what the site is and where an agent should look, in Markdown.
import { SITE, num } from "../lib/format.mjs";
import { MCP_URL } from "./connect.mjs";

export function llmsTxt(D, R, TOOLS) {
  const u = SITE.url;
  return `# ${SITE.name}

> ${SITE.tagline}. ${num(R.itemCount)} public spending records (provincial contract awards, minister and MHA expenses, public sector pay over $100,000, department and program spending, federal contracts, grants and transfers in the province), each linked to the government file and page or row it came from. A prototype: the figures were gathered and combined by automated scripts and have not been independently vetted.

The best way for an AI assistant to use the records is the read-only MCP server at ${MCP_URL} (streamable HTTP, no authentication). Cite source_url for every figure. A flagged pattern is a question, not a finding of wrongdoing.

## MCP server

- [MCP server](${MCP_URL}): tools ${TOOLS.map((t) => t.name).join(", ")}
- [How to connect an AI assistant](${u}/data/): steps for Claude, ChatGPT, Claude Code, Codex, Cursor, VS Code, Gemini CLI and others
- [server.json](${u}/server.json): MCP registry entry
- [Server card](${u}/mcp/server-card): MCP server card (draft)

## Pages

- [Search every record](${u}/search/): full-text search, filter by source, year and pattern
- [Priorities](${u}/priorities/): provincial department and program spending, actual against estimates
- [Patterns](${u}/flags/): patterns people ask about, each with its method and caveats
- [Members and ministers](${u}/members/): MHA allowance spending and ministers' expense claims
- [Sources and report card](${u}/sources/): what each source covers and how well it is published
- [Methods](${u}/method/): how each figure is worked out

## Data files

- [stats.json](${u}/data/stats.json): population, households, median wage, provincial revenue, with Statistics Canada tables
- [departments.json](${u}/data/departments.json): department spending by program and year
- [members.json](${u}/data/members.json): MHA spending by member, year and category; ministers' claim totals
- [flags.json](${u}/data/flags.json): each pattern's definition and method

## Optional

- [What is this?](${u}/about/): what the prototype is, and how far to trust it
- [Corrections](${u}/corrections/)
`;
}
