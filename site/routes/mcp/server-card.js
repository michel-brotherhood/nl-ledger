// MCP server card (draft SEP-2127): who this server is and where to connect, fetched before connecting.
import { serverCard } from "../../lib/mcp.mjs";

const HEADERS = {
  "content-type": "application/mcp-server-card+json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET",
  "access-control-allow-headers": "Content-Type, If-None-Match",
  "access-control-expose-headers": "ETag",
  "cache-control": "public, max-age=3600",
};

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const body = JSON.stringify(serverCard(), null, 2);
  const etag = `"${[...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body)))].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("")}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ...HEADERS, etag } });
  return new Response(request.method === "HEAD" ? null : body, { headers: { ...HEADERS, etag } });
}
