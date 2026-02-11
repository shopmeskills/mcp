#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  scoreProduct,
  calculateSimilarity,
  type ProductData,
} from "./scoring.js";
import { getRecommendations } from "./gemini-recommend.js";

const server = new McpServer({
  name: "product-recommendation",
  version: "1.0.0",
});

const ProductDataSchema = z.object({
  name: z.string().describe("Product name"),
  price: z.number().describe("Product price"),
  currency: z.string().default("CNY").describe("Currency code"),
  rating: z.number().optional().describe("Product rating (0-5)"),
  soldCount: z.number().optional().describe("Number of items sold"),
  reviewCount: z.number().optional().describe("Number of reviews"),
  shopRating: z.number().optional().describe("Shop/seller rating (0-5)"),
  platform: z.string().describe("Platform (taobao, aliexpress, 1688, tmall, xhs)"),
  category: z.string().optional().describe("Product category"),
  images: z.array(z.string()).optional().describe("Image URLs"),
  description: z.string().optional().describe("Product description text"),
});

// Tool 1: Score a product
server.tool(
  "score_product",
  {
    product: ProductDataSchema.describe("Product data to score"),
    averagePrice: z
      .number()
      .optional()
      .describe("Average market price for comparison (same currency as product)"),
  },
  async ({ product, averagePrice }) => {
    try {
      const score = scoreProduct(product as ProductData, averagePrice);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { product: product.name, ...score },
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
            text: `Scoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Find similar products (compare two)
server.tool(
  "find_similar",
  {
    product1: ProductDataSchema.describe("First product"),
    product2: ProductDataSchema.describe("Second product"),
  },
  async ({ product1, product2 }) => {
    try {
      const result = calculateSimilarity(
        product1 as ProductData,
        product2 as ProductData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                product1: product1.name,
                product2: product2.name,
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
            text: `Similarity check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Get AI-powered alternative recommendations
server.tool(
  "recommend_alternatives",
  {
    productName: z.string().min(1).describe("Product you're looking for alternatives to"),
    category: z.string().optional().describe("Product category"),
    budgetMin: z.number().optional().describe("Minimum budget"),
    budgetMax: z.number().optional().describe("Maximum budget"),
    budgetCurrency: z.string().default("CNY").describe("Budget currency"),
    preferences: z
      .array(z.string())
      .optional()
      .describe("User preferences (e.g. 'good quality', 'fast shipping', 'brand name')"),
    purpose: z.string().optional().describe("Purpose of purchase"),
  },
  async ({
    productName,
    category,
    budgetMin,
    budgetMax,
    budgetCurrency,
    preferences,
    purpose,
  }) => {
    try {
      const recommendations = await getRecommendations({
        productName,
        category,
        budget:
          budgetMin !== undefined && budgetMax !== undefined
            ? { min: budgetMin, max: budgetMax, currency: budgetCurrency }
            : undefined,
        preferences,
        purpose,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(recommendations, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Recommendation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 4: Batch score multiple products and rank them
server.tool(
  "rank_products",
  {
    products: z
      .array(ProductDataSchema)
      .min(2)
      .max(20)
      .describe("Array of products to score and rank"),
    averagePrice: z
      .number()
      .optional()
      .describe("Average market price for value scoring"),
  },
  async ({ products, averagePrice }) => {
    try {
      const scored = products.map((p) => ({
        name: p.name,
        platform: p.platform,
        price: p.price,
        currency: p.currency,
        score: scoreProduct(p as ProductData, averagePrice),
      }));

      scored.sort((a, b) => b.score.overall - a.score.overall);

      const ranked = scored.map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalProducts: products.length,
                topPick: ranked[0]
                  ? { name: ranked[0].name, score: ranked[0].score.overall }
                  : null,
                rankings: ranked,
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
            text: `Ranking failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Product Recommendation MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
