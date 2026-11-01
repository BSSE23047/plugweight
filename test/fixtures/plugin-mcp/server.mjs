// Minimal MCP server over stdio for tests. It exposes one tool and does nothing else.
import { createInterface } from "node:readline";
const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
createInterface({ input: process.stdin }).on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") reply(msg.id, { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "demo", version: "1.0.0" } });
  else if (msg.method === "tools/list") reply(msg.id, { tools: [{ name: "search", description: "Search the demo index for a phrase and return matches.", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } }] });
  else if (msg.id !== undefined) reply(msg.id, {});
});
