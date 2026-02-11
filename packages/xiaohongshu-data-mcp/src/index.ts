#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchNotes,
  getNoteDetail,
  searchProducts,
  getCreatorInfo,
} from "./xhs-client.js";

const server = new McpServer({
  name: "xiaohongshu-data",
  version: "1.0.0",
});

// Tool 1: Search notes
server.tool(
  "search_notes",
  {
    keyword: z.string().min(1).describe("Search keyword (Chinese recommended)"),
    page: z.number().int().min(1).default(1).describe("Page number"),
    pageSize: z.number().int().min(1).max(40).default(20).describe("Results per page"),
    sort: z
      .enum(["general", "popularity", "latest"])
      .default("general")
      .describe("Sort order: general (default), popularity (most liked), latest (newest)"),
    noteType: z
      .enum(["all", "normal", "video"])
      .default("all")
      .describe("Filter by note type"),
  },
  async ({ keyword, page, pageSize, sort, noteType }) => {
    try {
      const results = await searchNotes(keyword, {
        page,
        pageSize,
        sort,
        noteType,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Note search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: Get note detail
server.tool(
  "get_note_detail",
  {
    noteId: z.string().min(1).describe("Xiaohongshu note ID (from URL or search results)"),
  },
  async ({ noteId }) => {
    try {
      const note = await getNoteDetail(noteId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(note, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Get note detail failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Search products on Xiaohongshu Mall
server.tool(
  "search_xhs_products",
  {
    keyword: z.string().min(1).describe("Product search keyword"),
    page: z.number().int().min(1).default(1).describe("Page number"),
    pageSize: z.number().int().min(1).max(40).default(20).describe("Results per page"),
  },
  async ({ keyword, page, pageSize }) => {
    try {
      const results = await searchProducts(keyword, { page, pageSize });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Product search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 4: Get creator info
server.tool(
  "get_creator_info",
  {
    userId: z.string().min(1).describe("Xiaohongshu user/creator ID"),
  },
  async ({ userId }) => {
    try {
      const creator = await getCreatorInfo(userId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(creator, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Get creator info failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 5: Parse Xiaohongshu URL
server.tool(
  "parse_xhs_url",
  {
    url: z.string().min(1).describe("Xiaohongshu URL (note or product link)"),
  },
  async ({ url }) => {
    const noteMatch = url.match(
      /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]{24})/i,
    );
    const productMatch = url.match(
      /goods-detail\/([a-f0-9]{24})/i,
    );
    const userMatch = url.match(
      /xiaohongshu\.com\/user\/profile\/([a-f0-9]{24})/i,
    );
    const shortLinkMatch = url.match(/xhslink\.com\/\w+/i);

    const result: Record<string, unknown> = {
      originalUrl: url,
    };

    if (noteMatch) {
      result.type = "note";
      result.noteId = noteMatch[1];
      result.hint = "Use get_note_detail with this noteId";
    } else if (productMatch) {
      result.type = "product";
      result.productId = productMatch[1];
      result.hint = "Use search_xhs_products for more product info";
    } else if (userMatch) {
      result.type = "user";
      result.userId = userMatch[1];
      result.hint = "Use get_creator_info with this userId";
    } else if (shortLinkMatch) {
      result.type = "short_link";
      result.hint = "Short link detected. Follow the redirect to get the full URL, then parse again.";
    } else {
      result.type = "unknown";
      result.hint = "Could not parse this URL. Supported formats: note links, product links, user profiles.";
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Xiaohongshu Data MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
