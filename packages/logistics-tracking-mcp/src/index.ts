#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./app.js";

async function checkPlaywright() {
  try {
    const { isPlaywrightAvailable } = await import("./17track-playwright.js");
    if (!await isPlaywrightAvailable()) {
      console.error("[logistics-tracking] Playwright chromium not found.");
      console.error("[logistics-tracking] Run: npx playwright install chromium");
      console.error("[logistics-tracking] Without it, no-key tracking won't work (API key still works).");
    }
  } catch {
    console.error("[logistics-tracking] Playwright not installed. No-key tracking disabled.");
    console.error("[logistics-tracking] To enable: npm install playwright && npx playwright install chromium");
  }
}

async function main() {
  if (process.argv[2] === "serve") {
    await import("./server-http.js");
    return;
  }

  if (!process.env.TRACK17_API_KEY) {
    await checkPlaywright();
  }

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logistics Tracking MCP Server running on stdio");
}

async function cleanup() {
  try {
    const { closeBrowser } = await import("./17track-playwright.js");
    await closeBrowser();
  } catch { /* playwright not installed */ }
}
process.on("SIGINT", () => { cleanup().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { cleanup().finally(() => process.exit(0)); });

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
