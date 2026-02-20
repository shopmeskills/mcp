#!/usr/bin/env node

/**
 * HTTP server entry for logistics-tracking MCP (方案 A: 你部署带 Key 的服务，用户通过 URL 连接，无需自配 Key).
 * Run: npx @shopme/logistics-tracking-mcp serve
 * Or: MCP_TRANSPORT=http node build/server-http.js
 * Set TRACK17_API_KEY in env on the server so users don't need any key.
 */

import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session, simpler for server-only deployment
  });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    if (req.url !== "/mcp" && !req.url?.startsWith("/mcp?")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found. MCP endpoint: /mcp");
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Protocol-Id");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }
    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("MCP handleRequest error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    }
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`Logistics Tracking MCP HTTP server at http://${HOST}:${PORT}/mcp`);
    console.error("Set TRACK17_API_KEY on this server so users can query without their own key.");
  });
}

async function cleanup() {
  try {
    const { closeBrowser } = await import("./17track-playwright.js");
    await closeBrowser();
  } catch { /* playwright not installed */ }
}
process.on("SIGINT", () => { cleanup().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { cleanup().finally(() => process.exit(0)); });

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
