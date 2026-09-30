// How each AI assistant connects to the MCP server, and the starter questions.
// Every method here was either seen working (2026-09-29) or is quoted from the client's own
// documentation (the doc link is shown beside it). Keep it that way when adding a client.
import { SITE } from "../lib/format.mjs";

export const MCP_URL = `${SITE.url}/mcp`;
export const ICON_PNG = "/nl-ledger-icon-256.png";
const SLUG = "nl-ledger";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const json = (o) => JSON.stringify(o, null, 2);

export const LINKS = {
  claudeAdd: "https://claude.ai/customize/connectors?modal=add-custom-connector",
  cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=${SLUG}&config=${b64({ url: MCP_URL })}`,
  vscode: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: SLUG, type: "http", url: MCP_URL }))}`,
  lmstudio: `lmstudio://add_mcp?name=${SLUG}&config=${encodeURIComponent(b64({ url: MCP_URL }))}`,
  goose: `goose://extension?url=${encodeURIComponent(MCP_URL)}&type=streamable_http&timeout=300&id=${SLUG}&name=${encodeURIComponent(SITE.name)}&description=${encodeURIComponent("Public spending records for Newfoundland and Labrador")}`,
};

// verified: "tested" (connected and answered a question), "seen" (the screen or link was
// opened and checked, but no connection was made), "docs" (from the vendor's documentation only).
export const CLIENTS = [
  {
    id: "claude", name: "Claude", group: "chat",
    lead: "Add it once at claude.ai in a web browser, or in the Claude desktop app, signed in with your usual account. It then works in the iPhone and Android apps too. The phone apps cannot add it themselves.",
    copy: [{ label: "The address", text: MCP_URL }],
    action: { href: LINKS.claudeAdd, label: "Copy the address and open Claude", copies: MCP_URL, after: 0 },
    steps: [
      "Press the button above. It copies the address and opens Claude's Add custom connector box. (Or in Claude: Customize, then Connectors, then + Add, then Add custom connector.)",
      `For Name, type ${SITE.name}.`,
      "In MCP server URL, paste the address and press Continue. If it asks about sign-in, choose No sign-in, then Add.",
      "Start a new chat. The first time Claude uses NL Ledger it may ask your permission; allow it.",
    ],
    note: "The free plan allows one custom connector. On Team and Enterprise plans an owner adds it for the organization first.",
    verified: "seen", doc: "https://claude.com/docs/connectors/custom/add-unlisted",
  },
  {
    id: "chatgpt", name: "ChatGPT", group: "chat",
    lead: "Set it up at chatgpt.com in a web browser, on a Pro account or above. It does not work in the ChatGPT phone apps.",
    copy: [{ label: "The address", text: MCP_URL }],
    action: { href: "https://chatgpt.com/plugins", label: "Copy the address and open ChatGPT's plugins page", copies: MCP_URL, after: 1 },
    steps: [
      { text: "Download the icon first. ChatGPT only accepts an icon while the app is being created, and it cannot be added later.", download: { href: ICON_PNG, label: "Download the icon (PNG, 256 px)" } },
      "Press the button above. It copies the address and opens the plugins page. Press Add, then Create MCP App.",
      `Choose the icon you downloaded. For Name, type ${SITE.name}. For Description, type "Public spending records for Newfoundland and Labrador". Under Connection, choose Server URL and paste the address.`,
      "Under Authentication, choose No authentication. Tick \"I understand and want to continue\", press Create, then press Connect.",
      `Start a new chat, type @${SITE.name} and pick it from the list, or press Try in chat on the app's page. The app applies to the message it is attached to, so repeat this for each question.`,
    ],
    note: "On Pro accounts a custom app can read records but not change anything, which is all this one does.",
    verified: "tested", doc: "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt",
  },
  {
    id: "claude-code", name: "Claude Code", group: "code", lead: "Works in the terminal.",
    steps: ["Run this once. The server is then available in every Claude Code session in that folder (add --scope user for every folder)."],
    copy: [{ label: "Terminal", text: `claude mcp add --transport http ${SLUG} ${MCP_URL}` }],
    verified: "tested", doc: "https://code.claude.com/docs/en/mcp",
  },
  {
    id: "codex", name: "Codex", group: "code", lead: "Works in the Codex CLI, its IDE extension, and the ChatGPT desktop app, which share one setting.",
    steps: ["Run this once in a terminal, or add the lines below to ~/.codex/config.toml."],
    copy: [
      { label: "Terminal", text: `codex mcp add ${SLUG} --url ${MCP_URL}` },
      { label: "~/.codex/config.toml", text: `[mcp_servers.${SLUG}]\nurl = "${MCP_URL}"` },
    ],
    verified: "tested", doc: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
  },
  {
    id: "cursor", name: "Cursor", group: "code", lead: "Works in the Cursor editor.",
    action: { href: LINKS.cursor, label: "Add to Cursor", app: true },
    steps: ["Press Add to Cursor and confirm in Cursor. Or add this to .cursor/mcp.json in a project, or ~/.cursor/mcp.json for every project."],
    copy: [{ label: "mcp.json", text: json({ mcpServers: { [SLUG]: { url: MCP_URL } } }) }],
    verified: "docs", doc: "https://cursor.com/docs/context/mcp/install-links",
  },
  {
    id: "vscode", name: "VS Code", group: "code", lead: "Works in VS Code with GitHub Copilot.",
    action: { href: LINKS.vscode, label: "Add to VS Code", app: true },
    steps: ["Press Add to VS Code and confirm. Or add this to .vscode/mcp.json, or run MCP: Open User Configuration and add it there.", "Copilot Business and Enterprise need the \"MCP servers in Copilot\" policy turned on."],
    copy: [{ label: ".vscode/mcp.json", text: json({ servers: { [SLUG]: { type: "http", url: MCP_URL } } }) }],
    verified: "docs", doc: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
  },
  {
    id: "gemini", name: "Gemini CLI", group: "code", lead: "Works in the terminal. Google's docs say Gemini CLI was replaced by Antigravity CLI on 18 June 2026 for unpaid-tier and Google One users.",
    steps: ["Run this in the folder you work in (add -s user for every folder). Or add the lines below to settings.json by hand."],
    copy: [
      { label: "Terminal", text: `gemini mcp add --transport http ${SLUG} ${MCP_URL}` },
      { label: "~/.gemini/settings.json", text: json({ mcpServers: { [SLUG]: { httpUrl: MCP_URL } } }) },
    ],
    verified: "docs", doc: "https://geminicli.com/docs/tools/mcp-server/",
  },
  {
    id: "devin", name: "Windsurf / Devin", docName: "Devin", group: "code", lead: "Works in Devin Desktop, formerly Windsurf.",
    steps: ["Devin Local (the default agent): run the command below. Or put the JSON in ~/.config/devin/mcp_config.json for every project, or .devin/mcp_config.json for one.", "Cascade (the older agent): add the same JSON to ~/.config/devin/mcp_config.json (on Windows, %APPDATA%\\devin\\). Enterprise accounts must turn MCP on first."],
    copy: [
      { label: "Terminal", text: `devin mcp add ${SLUG} ${MCP_URL}` },
      { label: "mcp_config.json", text: json({ mcpServers: { [SLUG]: { serverUrl: MCP_URL } } }) },
    ],
    verified: "docs", doc: "https://docs.devin.ai/cli/extensibility/mcp/configuration",
  },
  {
    id: "goose", name: "Goose", group: "code", lead: "Works in Goose desktop and CLI.",
    action: { href: LINKS.goose, label: "Add to Goose", app: true },
    steps: ["Press Add to Goose. Or in the desktop app choose Extensions, then Add custom extension, type Streamable HTTP, and paste the address. In the CLI, run goose configure and add a remote extension."],
    copy: [{ label: "Address", text: MCP_URL }],
    verified: "docs", doc: "https://goose-docs.ai/docs/getting-started/using-extensions/",
  },
  {
    id: "lmstudio", name: "LM Studio", group: "code", lead: "Works in LM Studio 0.3.17 or later, with a local model.",
    action: { href: LINKS.lmstudio, label: "Add to LM Studio", app: true },
    steps: ["Press Add to LM Studio. Or open the Program tab, choose Install, then Edit mcp.json, and add this."],
    copy: [{ label: "mcp.json", text: json({ mcpServers: { [SLUG]: { url: MCP_URL } } }) }],
    note: "The model runs on your own computer, so it needs to be one that handles tool calls well.",
    verified: "docs", doc: "https://lmstudio.ai/docs/app/mcp/deeplink",
  },
];

// Clients with a documented way in but no picker tab. [name, where to add it, config or note, doc]
export const MORE = [
  ["Mistral Le Chat", "Connectors, then + Add Connector, then Custom MCP Connector. The account owner adds it.", "Paste the address; no authentication", "https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors"],
  ["Microsoft Copilot Studio", "In an agent: Tools, then Add a tool, then New tool, then Model Context Protocol", "Paste the address; authentication None", "https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent"],
  ["Zed", "Settings, then AI, then MCP Servers, then Add Remote Server", `"context_servers": { "${SLUG}": { "url": "${MCP_URL}" } }`, "https://zed.dev/docs/ai/mcp"],
  ["JetBrains AI Assistant", "Settings, Tools, AI Assistant, Model Context Protocol (MCP)", `"mcpServers": { "${SLUG}": { "url": "${MCP_URL}" } }`, "https://www.jetbrains.com/help/ai-assistant/mcp.html"],
  ["Cline", "MCP Servers, then the Remote Servers tab", `"${SLUG}": { "type": "streamableHttp", "url": "${MCP_URL}" }`, "https://docs.cline.bot/mcp/connecting-to-a-remote-server"],
  ["Continue", "A file in .continue/mcpServers/", `type: streamable-http, url: ${MCP_URL}`, "https://docs.continue.dev/customize/deep-dives/mcp"],
  ["opencode", "opencode.json", `"mcp": { "${SLUG}": { "type": "remote", "url": "${MCP_URL}" } }`, "https://opencode.ai/docs/mcp-servers/"],
  ["Warp", "Settings, then Agents, then MCP servers", `{ "${SLUG}": { "url": "${MCP_URL}" } }`, "https://docs.warp.dev/knowledge-and-collaboration/mcp"],
  ["Raycast", "The Install MCP Server command, transport HTTP (Raycast Pro)", "Paste the address", "https://manual.raycast.com/ai/model-context-protocol"],
];

// Starter questions. Each was checked against the tools on 2026-09-29 (the budget one on 2026-09-30):
// the tools return what the question needs. The "Using NL Ledger" prefix makes the assistant reach for the connector.
export const QUESTIONS = [
  { q: "What was the largest provincial contract awarded without an open call in 2025, and who got it?", tool: "search_records" },
  { q: "How much has Newfoundland Power received from all levels of government, and what were the largest amounts?", tool: "get_supplier" },
  { q: "Which MHAs claimed the most for travel in 2024-25, and what did the average member claim?", tool: "get_members" },
  { q: "Did the province spend more or less than it budgeted in 2024-25, and what were the deficit and the net debt?", tool: "get_budget" },
  { q: "How did Health and Community Services spending in 2024-25 compare with its budget, program by program?", tool: "get_department" },
  { q: "Which contracts grew the most after they were awarded? Explain how that is measured.", tool: "get_flag" },
  { q: "What does $50 million work out to per person and per household in Newfoundland and Labrador, and how long would it take to earn on the median wage?", tool: "human_scale" },
];
export const asked = (q) => `Using ${SITE.name}, ${q.charAt(0).toLowerCase()}${q.slice(1)}`;
export const askClaude = (q) => `https://claude.ai/new?q=${encodeURIComponent(asked(q))}`;
export const askChatGPT = (q) => `https://chatgpt.com/?q=${encodeURIComponent(asked(q))}`;

// A real answer, from Claude Code connected to the live server on 2026-09-29 (claude -p, no edits).
export const EXAMPLE = {
  q: "What was the largest provincial contract awarded without an open call in 2025, and who got it?",
  a: "The largest 2025 provincial contract awarded without competition was a $22 million power purchase agreement between Newfoundland and Labrador Hydro and Corner Brook Pulp and Paper Limited, signed November 3, 2025. It was a sole-source award, meaning the government said only one supplier was reasonably available, and it ran for five months. Automated scripts pulled these figures from public records and nobody has independently vetted them, so check the source before relying on it.",
  source: { href: "https://www.gov.nl.ca/ppa/files/Contract-Award-Report-2025-11-16-To-2025-11-30.pdf#page=3", label: "Contract award report, November 16 to 30, 2025, page 3" },
  record: "/item/15f8fb1f9d0b/",
  by: "Claude",
  via: "Claude Code",
  on: "2026-09-29",
};
