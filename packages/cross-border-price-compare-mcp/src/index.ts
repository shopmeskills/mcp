#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  calculateLandedCost,
  rankByLandedCost,
  estimateShipping,
} from "./cost-calculator.js";

const server = new McpServer({
  name: "cross-border-price-compare",
  version: "1.0.0",
});

// Tool 1: Compare prices across platforms
server.tool(
  "compare_price",
  {
    sources: z
      .array(
        z.object({
          platform: z.string().describe("Platform name (e.g. taobao, aliexpress, 1688)"),
          productName: z.string().describe("Product name/title"),
          priceCny: z.number().optional().describe("Price in CNY (Chinese Yuan)"),
          priceUsd: z.number().optional().describe("Price in USD"),
          weightKg: z
            .number()
            .optional()
            .describe("Estimated weight in kg (default 0.5)"),
        }),
      )
      .min(2)
      .max(10)
      .describe("Array of product sources to compare (min 2)"),
    category: z
      .enum([
        "electronics",
        "clothing",
        "shoes",
        "accessories",
        "cosmetics",
        "toys",
        "jewelry",
        "bags",
        "furniture",
        "general",
      ])
      .default("general")
      .describe("Product category for duty estimation"),
    destination: z
      .string()
      .default("US")
      .describe("Destination country code (US, GB, EU, CA, AU, JP, KR, SG, HK, TW)"),
    shippingMethod: z
      .enum(["economy", "standard", "express", "premium"])
      .default("standard")
      .describe("Shipping method"),
  },
  async ({ sources, category, destination, shippingMethod }) => {
    try {
      const ranked = rankByLandedCost(sources, {
        category,
        destination,
        shippingMethod,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                comparison: ranked,
                settings: { category, destination, shippingMethod },
                cheapest: ranked[0]
                  ? {
                      platform: ranked[0].platform,
                      totalCost: ranked[0].landedCost.totalLandedCost,
                    }
                  : null,
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
            text: `Price comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Calculate landed cost for a single product
server.tool(
  "calculate_landed_cost",
  {
    priceCny: z.number().optional().describe("Product price in CNY"),
    priceUsd: z.number().optional().describe("Product price in USD"),
    weightKg: z.number().default(0.5).describe("Estimated weight in kg"),
    category: z
      .enum([
        "electronics",
        "clothing",
        "shoes",
        "accessories",
        "cosmetics",
        "toys",
        "jewelry",
        "bags",
        "furniture",
        "general",
      ])
      .default("general")
      .describe("Product category"),
    destination: z.string().default("US").describe("Destination country code"),
    shippingMethod: z
      .enum(["economy", "standard", "express", "premium"])
      .default("standard")
      .describe("Shipping method"),
  },
  async ({ priceCny, priceUsd, weightKg, category, destination, shippingMethod }) => {
    try {
      if (priceCny === undefined && priceUsd === undefined) {
        return {
          content: [
            {
              type: "text",
              text: "Please provide either priceCny or priceUsd.",
            },
          ],
          isError: true,
        };
      }

      const result = calculateLandedCost({
        priceCny,
        priceUsd,
        weightKg,
        category,
        destination,
        shippingMethod,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Cost calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Estimate shipping cost
server.tool(
  "estimate_shipping",
  {
    weightKg: z.number().min(0.01).describe("Package weight in kg"),
    method: z
      .enum(["economy", "standard", "express", "premium"])
      .default("standard")
      .describe("Shipping method"),
    destination: z.string().default("US").describe("Destination country code"),
  },
  async ({ weightKg, method, destination }) => {
    const allMethods = ["economy", "standard", "express", "premium"] as const;

    const estimates = allMethods.map((m) => estimateShipping(weightKg, m, destination));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              weightKg,
              destination,
              selectedMethod: method,
              selectedEstimate: estimates.find((e) => e.method === method),
              allOptions: estimates,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Tool 4: Convert currency
server.tool(
  "convert_currency",
  {
    amount: z.number().describe("Amount to convert"),
    from: z
      .enum(["CNY", "USD", "HKD", "EUR", "GBP", "JPY", "KRW", "AUD", "CAD", "SGD"])
      .describe("Source currency"),
    to: z
      .enum(["CNY", "USD", "HKD", "EUR", "GBP", "JPY", "KRW", "AUD", "CAD", "SGD"])
      .describe("Target currency"),
  },
  async ({ amount, from, to }) => {
    // Approximate rates (to USD)
    const toUsd: Record<string, number> = {
      CNY: 0.139,
      USD: 1.0,
      HKD: 0.128,
      EUR: 1.08,
      GBP: 1.27,
      JPY: 0.0067,
      KRW: 0.00074,
      AUD: 0.65,
      CAD: 0.74,
      SGD: 0.75,
    };

    const fromRate = toUsd[from];
    const toRate = toUsd[to];

    if (!fromRate || !toRate) {
      return {
        content: [
          { type: "text", text: `Unsupported currency: ${from} or ${to}` },
        ],
        isError: true,
      };
    }

    const usdAmount = amount * fromRate;
    const converted = usdAmount / toRate;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              original: { amount, currency: from },
              converted: {
                amount: Math.round(converted * 100) / 100,
                currency: to,
              },
              rate: Math.round((fromRate / toRate) * 10000) / 10000,
              note: "Rates are approximate. Check live rates for accuracy.",
            },
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
  console.error("Cross-border Price Compare MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
