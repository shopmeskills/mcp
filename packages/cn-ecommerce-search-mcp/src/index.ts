#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchProducts, getProductDetail } from "./shopme-client.js";
import { parseProductLink } from "./link-parser.js";

const server = new McpServer({
  name: "cn-ecommerce-search",
  version: "2.0.0",
});

const platformEnum = z.enum(["xhs", "taobao", "tmall"]);

const PLATFORM_DESC = "来源平台过滤。xhs=小红书, taobao=淘宝, tmall=天猫";

// ── Tool 1: search_products ─────────────────────────────────────

server.tool(
  "search_products",
  "在 Shopme 商品库中搜索商品。支持中英文关键词，可按平台过滤、按价格/相关性/销量排序。返回商品名称、价格、图片、店铺等摘要信息。",
  {
    keyword: z.string().min(1).describe("搜索关键词（中文或英文均可）"),
    platform: platformEnum.optional().describe(PLATFORM_DESC),
    sort_by: z
      .enum(["relevance", "price_asc", "price_desc", "sales_desc", "created_at"])
      .default("relevance")
      .describe("排序方式，默认 relevance（相关性）"),
    page: z.number().int().min(1).default(1).describe("页码，默认 1"),
    limit: z.number().int().min(1).max(50).default(10).describe("每页数量，默认 10，最大 50"),
  },
  async ({ keyword, platform, sort_by, page, limit }) => {
    try {
      const result = await searchProducts({
        keyword,
        platform,
        sort_by,
        page,
        limit,
      });

      if (!result.success) {
        return {
          content: [{ type: "text", text: `搜索失败: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `搜索失败: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ── Tool 2: get_product_detail ──────────────────────────────────

server.tool(
  "get_product_detail",
  "获取单个商品的完整详情，包括名称、价格、描述、图片、SKU 规格、标签和预估重量。通过商品 ID 或商品 URL 查询。",
  {
    product_id: z.string().optional().describe("商品 ID（与 url 二选一，推荐优先使用）"),
    url: z.string().optional().describe("商品原始 URL（与 product_id 二选一）"),
    platform: platformEnum.optional().describe("平台名称，使用 product_id 查询时建议提供以加速查询"),
  },
  async ({ product_id, url, platform }) => {
    if (!product_id && !url) {
      return {
        content: [{ type: "text", text: "请提供 product_id 或 url 中的至少一个" }],
        isError: true,
      };
    }

    try {
      const result = await getProductDetail({
        product_id,
        url,
        platform,
      });

      if (!result.success) {
        return {
          content: [{ type: "text", text: result.error || "商品未找到" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `获取详情失败: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ── Tool 3: parse_product_link ──────────────────────────────────

server.tool(
  "parse_product_link",
  "解析商品链接，识别来源平台和商品 ID。支持淘宝、天猫、1688、京东、拼多多、抖音、速卖通、小红书等平台的链接。",
  {
    url: z.string().min(1).describe("商品链接或包含链接的文本"),
  },
  async ({ url }) => {
    const linkInfo = parseProductLink(url);
    return {
      content: [{ type: "text", text: JSON.stringify(linkInfo, null, 2) }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CN Ecommerce Search MCP Server v2 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
