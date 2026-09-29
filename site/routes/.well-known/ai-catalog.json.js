// AI catalog (draft MCP discovery): served by the Worker, so the dot-folder never has to be an asset.
import { aiCatalog } from "../../lib/mcp.mjs";

export function onRequest() {
  return new Response(JSON.stringify(aiCatalog(), null, 2) + "\n", {
    headers: { "content-type": "application/ai-catalog+json", "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
  });
}
