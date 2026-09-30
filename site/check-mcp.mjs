// Smoke-test every MCP tool against the committed sample data, through the local HTTP server.
// Runs in CI without a Cloudflare account: `node site/check-mcp.mjs`.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SITE, "..");
const EXPECTED_TOOLS = [
  "search_records", "get_record", "get_supplier", "get_department", "get_budget",
  "get_members", "list_flags", "get_flag", "human_scale", "search", "fetch",
];

function check(ok, message) {
  if (!ok) throw new Error(message);
  console.log(`ok  ${message}`);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function main() {
  const port = await availablePort();
  const child = spawn(process.execPath, ["site/dev.mjs", String(port)], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  const keepLog = (chunk) => { serverLog = (serverLog + chunk.toString()).slice(-8000); };
  child.stdout.on("data", keepLog);
  child.stderr.on("data", keepLog);
  child.on("error", keepLog);
  const base = `http://127.0.0.1:${port}`;
  let stopping = false;
  const stop = async () => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return;
    stopping = true;
    const closed = new Promise((resolveClose) => child.once("close", resolveClose));
    child.kill("SIGTERM");
    let timer;
    await Promise.race([closed, new Promise((resolveTimeout) => {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolveTimeout();
      }, 3000);
    })]);
    clearTimeout(timer);
  };

  try {
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Local server exited unexpectedly.\n${serverLog}`);
      }
      try {
        const response = await fetch(`${base}/mcp`);
        if (response.ok && (await response.text()).includes("MCP server")) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    if (!ready) throw new Error(`Local sample server did not start within 90 seconds.\n${serverLog}`);
    check(true, "local sample server is ready");

    let nextId = 0;
    const rpc = async (method, params = {}) => {
      const id = ++nextId;
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
      check(response.ok, `${method} returns HTTP ${response.status}`);
      const body = await response.json();
      check(body.jsonrpc === "2.0" && body.id === id && !body.error, `${method} returns a valid JSON-RPC response`);
      return body.result;
    };

    const listed = await rpc("tools/list");
    const tools = listed?.tools;
    check(Array.isArray(tools) && tools.length > 0, "tools/list returns tools");
    const names = tools.map((tool) => tool.name).sort();
    check(JSON.stringify(names) === JSON.stringify([...EXPECTED_TOOLS].sort()), "every current MCP tool has a test fixture");

    const callTool = async (name, args, requiredFields) => {
      check(tools.some((tool) => tool.name === name), `${name} is advertised`);
      const response = await rpc("tools/call", { name, arguments: args });
      check(response?.isError !== true, `${name} completes without an MCP tool error`);
      const text = response?.content?.find((item) => item.type === "text")?.text;
      check(typeof text === "string" && text.length > 0, `${name} returns text content`);
      let content;
      try {
        content = JSON.parse(text);
      } catch {
        throw new Error(`${name} text content is not valid JSON.`);
      }
      const data = response?.structuredContent;
      check(data && typeof data === "object" && !Array.isArray(data), `${name} returns structured data`);
      check(JSON.stringify(content) === JSON.stringify(data), `${name} text and structured content agree`);
      for (const field of requiredFields) {
        const value = data[field];
        check(value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0), `${name} returns ${field}`);
      }
      return data;
    };

    const records = await callTool("search_records", { query: "ferry" }, ["records"]);
    const record = records.records.find((item) => item.id && item.supplier_id);
    check(record, "sample search provides a record and supplier id for dependent calls");

    await callTool("get_record", { id: record.id }, ["id", "source"]);
    await callTool("get_supplier", { supplier_id: record.supplier_id }, ["supplier_id", "name", "largest_records"]);
    const departments = await callTool("get_department", {}, ["departments"]);
    check(departments.departments.length > 0, "sample data includes departments");
    await callTool("get_budget", {}, ["fiscal_year", "departments"]);
    await callTool("get_members", {}, ["ranking"]);
    const flags = await callTool("list_flags", {}, ["flags"]);
    await callTool("get_flag", { id: flags.flags[0].id }, ["id", "title"]);
    await callTool("human_scale", { amount: 50_000_000 }, ["amount", "per_resident"]);

    const search = await callTool("search", { query: "ferry" }, ["results"]);
    const result = search.results.find((item) => item.id);
    check(result, "sample search provides a result id for fetch");
    await callTool("fetch", { id: result.id }, ["id", "text", "url"]);
    console.log("\nMCP checks: pass");
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(`\nMCP checks: FAIL — ${error.stack || error.message}`);
  process.exitCode = 1;
});
