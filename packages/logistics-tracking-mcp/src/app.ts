/**
 * Shared MCP server and tools. Used by both stdio (index.ts) and HTTP (server-http.ts) entry points.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectCarrier, CARRIER_PATTERNS } from "./carriers.js";
import { queryTracking, queryTrackingNoKey } from "./providers.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "logistics-tracking",
    version: "1.0.0",
  });

  server.tool(
    "track_package",
    {
      trackingNumber: z.string().min(5).describe("Tracking number (e.g. LX123456789CN)"),
      carrier: z.string().optional().describe("Carrier name (auto-detected if omitted)"),
      language: z.string().default("en").describe("Response language (default: en)"),
    },
    async ({ trackingNumber, carrier, language }) => {
      try {
        const detectedCarrier = carrier || detectCarrier(trackingNumber);
        const apiKey = process.env.TRACK17_API_KEY;
        const result = apiKey
          ? await queryTracking(trackingNumber, detectedCarrier, apiKey, language)
          : await queryTrackingNoKey(trackingNumber, language);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ trackingNumber, carrier: detectedCarrier, ...result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Tracking query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "detect_carrier",
    { trackingNumber: z.string().min(5).describe("Tracking number to identify") },
    async ({ trackingNumber }) => {
      const carrier = detectCarrier(trackingNumber);
      const confidence = carrier !== "unknown" ? "high" : "low";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { trackingNumber, carrier, confidence, supportedCarriers: Object.keys(CARRIER_PATTERNS) },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "batch_track",
    {
      trackingNumbers: z.array(z.string().min(5)).min(1).max(40).describe("Array of tracking numbers (max 40)"),
      language: z.string().default("en").describe("Response language (default: en)"),
    },
    async ({ trackingNumbers, language }) => {
      const apiKey = process.env.TRACK17_API_KEY;
      const results = await Promise.allSettled(
        trackingNumbers.map(async (num) => {
          const carrier = detectCarrier(num);
          try {
            const data = apiKey
              ? await queryTracking(num, carrier, apiKey, language)
              : await queryTrackingNoKey(num, language);
            return { trackingNumber: num, carrier, ...data };
          } catch (error) {
            return {
              trackingNumber: num,
              carrier,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );
      const output = results.map((r) => (r.status === "fulfilled" ? r.value : { error: "Query failed" }));
      return {
        content: [{ type: "text", text: JSON.stringify({ total: trackingNumbers.length, results: output }, null, 2) }],
      };
    },
  );

  const STATUS_MAP: Record<string, { description: string; advice: string }> = {
    InfoReceived: {
      description: "Shipment information received by carrier, not yet picked up",
      advice: "Wait 1-3 days for pickup.",
    },
    InTransit: {
      description: "Package is in transit",
      advice: "Normal transit. International shipping typically takes 7-30 days.",
    },
    CustomsClearance: {
      description: "Package is going through customs clearance",
      advice: "Customs clearance usually takes 3-7 business days. May require additional documentation.",
    },
    PickedUp: {
      description: "Package has been picked up by carrier",
      advice: "Package is now in the carrier's network.",
    },
    OutForDelivery: {
      description: "Package is out for delivery",
      advice: "Should arrive today. Ensure someone is available to receive.",
    },
    Delivered: {
      description: "Package has been delivered",
      advice: "Delivery confirmed.",
    },
    Exception: {
      description: "Delivery exception occurred",
      advice: "Contact the carrier or seller for more information. Could be customs hold, address issue, or failed delivery.",
    },
    Returned: {
      description: "Package is being returned to sender",
      advice: "Contact seller for refund or re-shipment.",
    },
  };

  server.tool(
    "explain_status",
    { statusCode: z.string().describe("Status code (e.g. InTransit, CustomsClearance, Delivered)") },
    async ({ statusCode }) => {
      const normalized = Object.keys(STATUS_MAP).find((k) => k.toLowerCase() === statusCode.toLowerCase());
      const entry = normalized ? STATUS_MAP[normalized] : null;
      const payload = entry
        ? { statusCode: normalized, ...entry }
        : { statusCode, description: "Unknown status code", advice: "Try one of: " + Object.keys(STATUS_MAP).join(", ") };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  return server;
}
