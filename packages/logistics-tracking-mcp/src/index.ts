#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { detectCarrier, CARRIER_PATTERNS } from "./carriers.js";
import { queryTracking, queryTrackingFallback } from "./providers.js";

const server = new McpServer({
  name: "logistics-tracking",
  version: "1.0.0",
});

// Tool 1: Track a single package
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
      let result;

      if (apiKey) {
        result = await queryTracking(trackingNumber, detectedCarrier, apiKey, language);
      } else {
        result = await queryTrackingFallback(trackingNumber, language);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                trackingNumber,
                carrier: detectedCarrier,
                ...result,
              },
              null,
              2,
            ),
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

// Tool 2: Detect carrier from tracking number
server.tool(
  "detect_carrier",
  {
    trackingNumber: z.string().min(5).describe("Tracking number to identify"),
  },
  async ({ trackingNumber }) => {
    const carrier = detectCarrier(trackingNumber);
    const confidence = carrier !== "unknown" ? "high" : "low";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              trackingNumber,
              carrier,
              confidence,
              supportedCarriers: Object.keys(CARRIER_PATTERNS),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Tool 3: Batch track multiple packages
server.tool(
  "batch_track",
  {
    trackingNumbers: z
      .array(z.string().min(5))
      .min(1)
      .max(40)
      .describe("Array of tracking numbers (max 40)"),
    language: z.enum(["en", "zh"]).default("en").describe("Response language"),
  },
  async ({ trackingNumbers, language }) => {
    const apiKey = process.env.TRACK17_API_KEY;

    const results = await Promise.allSettled(
      trackingNumbers.map(async (num) => {
        const carrier = detectCarrier(num);
        try {
          let data;
          if (apiKey) {
            data = await queryTracking(num, carrier, apiKey, language);
          } else {
            data = await queryTrackingFallback(num, language);
          }
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

    const output = results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: "Query failed" },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { total: trackingNumbers.length, results: output },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Tool 4: Explain a tracking status code
server.tool(
  "explain_status",
  {
    statusCode: z.string().describe("Status code (e.g. InTransit, CustomsClearance, Delivered)"),
  },
  async ({ statusCode }) => {
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

    const normalized = Object.keys(STATUS_MAP).find(
      (k) => k.toLowerCase() === statusCode.toLowerCase(),
    );

    if (normalized && STATUS_MAP[normalized]) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { statusCode: normalized, ...STATUS_MAP[normalized] },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              statusCode,
              en: "Unknown status code",
              zh: "未知状态码",
              advice: "Try one of: " + Object.keys(STATUS_MAP).join(", "),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logistics Tracking MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
