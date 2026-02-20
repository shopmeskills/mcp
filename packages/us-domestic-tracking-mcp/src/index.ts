#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { detectCarrier, CARRIER_PATTERNS, isSupportedCarrier } from "./carriers.js";
import { queryTracking } from "./providers.js";

const server = new McpServer({
  name: "us-domestic-tracking",
  version: "1.0.0",
});

function getEnv() {
  return {
    USPS_CONSUMER_KEY: process.env.USPS_CONSUMER_KEY,
    USPS_CONSUMER_SECRET: process.env.USPS_CONSUMER_SECRET,
    UPS_CLIENT_ID: process.env.UPS_CLIENT_ID,
    UPS_CLIENT_SECRET: process.env.UPS_CLIENT_SECRET,
    USPS_USE_TEST_ENV: process.env.USPS_USE_TEST_ENV,
  };
}

// Tool 1: Track a single package (US domestic: UPS, USPS)
server.tool(
  "track_package",
  {
    trackingNumber: z.string().min(5).describe("US domestic tracking number (e.g. 1Z999AA10123456784 or 94xxx)"),
    carrier: z.string().optional().describe("Carrier: usps, ups, or fedex (auto-detected if omitted)"),
  },
  async ({ trackingNumber, carrier }) => {
    try {
      const detected = carrier || detectCarrier(trackingNumber);
      if (!isSupportedCarrier(detected)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  trackingNumber,
                  carrier: detected,
                  status: "Unknown",
                  note: "This server supports US domestic carriers only: usps, ups. Use logistics-tracking MCP for international.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      const result = await queryTracking(trackingNumber, detected, getEnv());
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { trackingNumber, carrier: detected, ...result },
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
            text: `Tracking failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Detect US domestic carrier from tracking number
server.tool(
  "detect_carrier",
  {
    trackingNumber: z.string().min(5).describe("Tracking number to identify (US domestic format)"),
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
              note: "US domestic only: usps, ups, fedex.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Tool 3: Batch track (US domestic)
server.tool(
  "batch_track",
  {
    trackingNumbers: z
      .array(z.string().min(5))
      .min(1)
      .max(40)
      .describe("Array of US domestic tracking numbers (max 40)"),
  },
  async ({ trackingNumbers }) => {
    const env = getEnv();
    const results = await Promise.all(
      trackingNumbers.map(async (num) => {
        const carrier = detectCarrier(num);
        try {
          const data = await queryTracking(num, carrier, env);
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
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total: trackingNumbers.length, results }, null, 2),
        },
      ],
    };
  },
);

// Tool 4: Explain status code
server.tool(
  "explain_status",
  {
    statusCode: z.string().describe("Status code (e.g. InTransit, OutForDelivery, Delivered)"),
  },
  async ({ statusCode }) => {
    const STATUS_MAP: Record<string, { en: string; advice: string }> = {
      InfoReceived: {
        en: "Shipment information received; not yet picked up",
        advice: "Wait 1–3 days for pickup.",
      },
      InTransit: {
        en: "Package is in transit",
        advice: "Normal transit. US domestic typically 1–5 business days.",
      },
      OutForDelivery: {
        en: "Out for delivery today",
        advice: "Ensure someone is available to receive.",
      },
      Delivered: {
        en: "Delivered",
        advice: "Delivery confirmed.",
      },
      Exception: {
        en: "Delivery exception",
        advice: "Check carrier site or contact carrier. May be hold, failed attempt, or address issue.",
      },
      Returned: {
        en: "Return to sender",
        advice: "Contact sender for refund or re-shipment.",
      },
    };
    const normalized = Object.keys(STATUS_MAP).find((k) => k.toLowerCase() === statusCode.toLowerCase());
    const entry = normalized ? STATUS_MAP[normalized] : null;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            entry
              ? { statusCode: normalized, ...entry }
              : { statusCode, en: "Unknown status", advice: "Known codes: " + Object.keys(STATUS_MAP).join(", ") },
            null,
            2,
          ),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("US Domestic Tracking MCP Server running (UPS, USPS; for OpenClaw/government use)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
