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
      language: z.enum(["en", "zh"]).default("en").describe("Response language"),
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
      language: z.enum(["en", "zh"]).default("en").describe("Response language"),
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

  const STATUS_MAP: Record<string, { en: string; zh: string; advice: string }> = {
    InfoReceived: {
      en: "Shipment information received by carrier, not yet picked up",
      zh: "物流商已收到信息，尚未揽收",
      advice: "Wait 1-3 days for pickup.",
    },
    InTransit: {
      en: "Package is in transit",
      zh: "包裹运输中",
      advice: "Normal transit. International shipping typically takes 7-30 days.",
    },
    CustomsClearance: {
      en: "Package is going through customs clearance",
      zh: "包裹正在清关中",
      advice: "Customs clearance usually takes 3-7 business days. May require additional documentation.",
    },
    PickedUp: {
      en: "Package has been picked up by carrier",
      zh: "包裹已被物流商揽收",
      advice: "Package is now in the carrier's network.",
    },
    OutForDelivery: {
      en: "Package is out for delivery",
      zh: "包裹正在派送中",
      advice: "Should arrive today. Ensure someone is available to receive.",
    },
    Delivered: {
      en: "Package has been delivered",
      zh: "包裹已签收",
      advice: "Delivery confirmed.",
    },
    Exception: {
      en: "Delivery exception occurred",
      zh: "物流异常",
      advice: "Contact the carrier or seller for more information. Could be customs hold, address issue, or failed delivery.",
    },
    Returned: {
      en: "Package is being returned to sender",
      zh: "包裹正在退回寄件人",
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
        : { statusCode, en: "Unknown status code", zh: "未知状态码", advice: "Try one of: " + Object.keys(STATUS_MAP).join(", ") };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  return server;
}
