#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchByImageTaobao,
  uploadImageToTaobao,
} from "./taobao-image.js";
import {
  searchByImageAliExpress,
} from "./aliexpress-image.js";
import { analyzeImageWithGemini } from "./gemini-ocr.js";

const server = new McpServer({
  name: "visual-product-search",
  version: "1.0.0",
});

// Tool 1: Search products by image URL
server.tool(
  "search_by_image",
  {
    imageUrl: z.string().url().describe("URL of the product image to search"),
    platform: z
      .enum(["taobao", "aliexpress", "all"])
      .default("all")
      .describe("Platform to search on"),
    pageNo: z.number().int().min(1).default(1).describe("Page number"),
    pageSize: z.number().int().min(1).max(50).default(20).describe("Items per page"),
  },
  async ({ imageUrl, platform, pageNo, pageSize }) => {
    try {
      const results: Record<string, unknown> = {};

      if (platform === "taobao" || platform === "all") {
        try {
          const taobaoResults = await searchByImageTaobao(imageUrl, {
            pageNo,
            pageSize,
          });
          results.taobao = taobaoResults;
        } catch (error) {
          results.taobao = {
            error: error instanceof Error ? error.message : "Taobao image search failed",
          };
        }
      }

      if (platform === "aliexpress" || platform === "all") {
        try {
          const aeResults = await searchByImageAliExpress(imageUrl, {
            pageNo,
            pageSize,
          });
          results.aliexpress = aeResults;
        } catch (error) {
          results.aliexpress = {
            error:
              error instanceof Error
                ? error.message
                : "AliExpress image search failed",
          };
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { imageUrl, platform, results },
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
            text: `Image search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Upload a local image (base64) and search
server.tool(
  "search_by_image_upload",
  {
    imageBase64: z
      .string()
      .min(100)
      .describe("Base64-encoded image data (without data:image prefix)"),
    platform: z
      .enum(["taobao", "aliexpress", "all"])
      .default("taobao")
      .describe("Platform to search on"),
    pageSize: z.number().int().min(1).max(50).default(20).describe("Items per page"),
  },
  async ({ imageBase64, platform, pageSize }) => {
    try {
      // Upload to Taobao CDN first to get a URL
      const uploadResult = await uploadImageToTaobao(imageBase64);

      if (!uploadResult.picUrl) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to upload image. Cannot proceed with search.",
            },
          ],
          isError: true,
        };
      }

      const results: Record<string, unknown> = {};

      if (platform === "taobao" || platform === "all") {
        try {
          results.taobao = await searchByImageTaobao(uploadResult.picUrl, {
            pageSize,
          });
        } catch (error) {
          results.taobao = {
            error: error instanceof Error ? error.message : "Taobao search failed",
          };
        }
      }

      if (platform === "aliexpress" || platform === "all") {
        try {
          results.aliexpress = await searchByImageAliExpress(
            uploadResult.picUrl,
            { pageSize },
          );
        } catch (error) {
          results.aliexpress = {
            error:
              error instanceof Error
                ? error.message
                : "AliExpress search failed",
          };
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                uploadedImageUrl: uploadResult.picUrl,
                platform,
                results,
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
            text: `Upload + search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Extract product info from image using AI (Gemini OCR)
server.tool(
  "extract_product_from_image",
  {
    imageUrl: z.string().url().describe("URL of product image or screenshot"),
    language: z.enum(["en", "zh"]).default("en").describe("Output language"),
  },
  async ({ imageUrl, language }) => {
    try {
      const analysis = await analyzeImageWithGemini(imageUrl, language);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Image analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  console.error("Visual Product Search MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
