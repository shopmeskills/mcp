#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseProductLink } from "./link-parser.js";
import { searchProducts, getProductDetail } from "./taobao-client.js";
import { searchAliExpress, getAliExpressDetail } from "./aliexpress-client.js";

const server = new McpServer({
  name: "cn-ecommerce-search",
  version: "1.0.0",
});

// Tool 1: Search products by keyword
server.tool(
  "search_products",
  {
    keyword: z.string().min(1).describe("Search keyword (Chinese or English)"),
    platform: z
      .enum(["taobao", "aliexpress", "all"])
      .default("all")
      .describe("Platform to search on"),
    pageNo: z.number().int().min(1).default(1).describe("Page number"),
    pageSize: z.number().int().min(1).max(50).default(20).describe("Items per page"),
    sort: z
      .enum(["PRICE_ASC", "PRICE_DESC", "SALE_QTY_DESC"])
      .optional()
      .describe("Sort order"),
    language: z.enum(["en", "zh"]).default("en").describe("Result language"),
  },
  async ({ keyword, platform, pageNo, pageSize, sort, language }) => {
    try {
      const results: Record<string, unknown> = {};

      if (platform === "taobao" || platform === "all") {
        try {
          const taobaoResults = await searchProducts(keyword, {
            pageNo,
            pageSize,
            sort,
            language,
          });
          results.taobao = taobaoResults;
        } catch (error) {
          results.taobao = {
            error: error instanceof Error ? error.message : "Taobao search failed",
          };
        }
      }

      if (platform === "aliexpress" || platform === "all") {
        try {
          const aeResults = await searchAliExpress(keyword, {
            pageNo,
            pageSize,
            sort:
              sort === "PRICE_ASC"
                ? "SALE_PRICE_ASC"
                : sort === "PRICE_DESC"
                  ? "SALE_PRICE_DESC"
                  : sort === "SALE_QTY_DESC"
                    ? "LAST_VOLUME_DESC"
                    : undefined,
            language,
          });
          results.aliexpress = aeResults;
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
              { keyword, platform, results },
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
            text: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Get product detail by ID and platform
server.tool(
  "get_product_detail",
  {
    productId: z.string().min(1).describe("Product ID"),
    platform: z
      .enum(["taobao", "aliexpress"])
      .describe("Platform the product belongs to"),
    language: z.enum(["en", "zh"]).default("en").describe("Result language"),
  },
  async ({ productId, platform, language }) => {
    try {
      let detail;

      if (platform === "taobao") {
        detail = await getProductDetail(productId, language);
      } else {
        detail = await getAliExpressDetail(productId, { language });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(detail, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get product detail: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Parse a product link to identify platform and product ID
server.tool(
  "parse_product_link",
  {
    url: z.string().min(1).describe("Product URL or text containing a product URL"),
  },
  async ({ url }) => {
    const linkInfo = parseProductLink(url);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(linkInfo, null, 2),
        },
      ],
    };
  },
);

// Tool 4: Get product from URL (parse + fetch in one step)
server.tool(
  "get_product_from_url",
  {
    url: z.string().min(1).describe("Product URL from any supported platform"),
    language: z.enum(["en", "zh"]).default("en").describe("Result language"),
  },
  async ({ url, language }) => {
    try {
      const linkInfo = parseProductLink(url);

      if (!linkInfo.isValid || !linkInfo.productId) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: linkInfo.error || "Could not parse product URL",
                  parsed: linkInfo,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      let detail;
      if (linkInfo.platform === "taobao" || linkInfo.platform === "tmall") {
        detail = await getProductDetail(linkInfo.productId, language);
      } else if (linkInfo.platform === "aliexpress") {
        detail = await getAliExpressDetail(linkInfo.productId, { language });
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  parsed: linkInfo,
                  note: `Platform "${linkInfo.platform}" is supported for link parsing but not for detail fetching via API. Use the product ID with the platform's tools.`,
                },
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
              { parsed: linkInfo, product: detail },
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
            text: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  console.error("CN Ecommerce Search MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
