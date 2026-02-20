#!/usr/bin/env npx tsx
/**
 * Test script for logistics-tracking skill.
 * Run from repo root: pnpm --filter @shopmeagent/logistics-tracking-mcp run test:skill
 * Or: cd packages/logistics-tracking-mcp && npx tsx scripts/test-skill.ts
 *
 * Tests:
 * 1. detect_carrier — pattern recognition
 * 2. track_package (no-key) — Playwright path or SetupRequired
 * 3. Optional: track_package with TRACK17_API_KEY if set
 */

import { detectCarrier } from "../src/carriers.js";
import { queryTrackingNoKey, queryTracking } from "../src/providers.js";

const TRACKING_NUMBER = process.env.TEST_TRACKING_NUMBER || "YT2431132964573"; // Yanwen format

async function main() {
  console.log("=== 1. detect_carrier ===\n");

  const examples = [
    "YT2431132964573",
    "LX123456789CN",
    "EA123456789CN",
    "1Z999AA10123456784",
    "9400111899223100012345",
  ];

  for (const num of examples) {
    const carrier = detectCarrier(num);
    console.log(`  ${num} → ${carrier}`);
  }

  console.log("\n=== 2. track_package (no key) ===\n");

  const hasKey = !!process.env.TRACK17_API_KEY;
  if (hasKey) {
    console.log("  TRACK17_API_KEY is set, testing API path...");
    try {
      const carrier = detectCarrier(TRACKING_NUMBER);
      const result = await queryTracking(TRACKING_NUMBER, carrier, process.env.TRACK17_API_KEY!, "en");
      console.log("  Status:", result.status);
      console.log("  Events:", result.timeline.length);
      if (result.timeline.length > 0) {
        console.log("  Latest:", result.timeline[0].description?.slice(0, 60) + "...");
      }
    } catch (e) {
      console.log("  Error:", e instanceof Error ? e.message : e);
    }
  } else {
    console.log("  No TRACK17_API_KEY, testing Playwright (no-key) path...");
    console.log("  (First run may take ~15s; ensure: npx playwright install chromium)\n");

    const result = await queryTrackingNoKey(TRACKING_NUMBER, "en");

    console.log("  Status:", result.status);
    console.log("  Events:", result.timeline.length);
    if (result.rawData) {
      const raw = result.rawData as Record<string, unknown>;
      if (raw.note) console.log("  Note:", raw.note);
      if (raw.setup) console.log("  Setup:", raw.setup);
      if (raw.webUrl) console.log("  Web:", raw.webUrl);
    }
    if (result.timeline.length > 0) {
      console.log("  Latest:", result.timeline[0].description?.slice(0, 60) + "...");
    }

    try {
      const { closeBrowser } = await import("../src/17track-playwright.js");
      await closeBrowser();
    } catch { /* ignore */ }
  }

  console.log("\n=== Done ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
