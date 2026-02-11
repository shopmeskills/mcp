---
name: xiaohongshu-data
description: >
  Search and analyze Xiaohongshu (RED / Little Red Book) content including notes, products, and creator profiles.
  Use when the user asks about Xiaohongshu trends, wants to find products or reviews on RED, or needs creator/influencer data.
  Triggers: 小红书, xiaohongshu, RED, Little Red Book, xhs.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopme/xiaohongshu-data-mcp"
---

# Xiaohongshu (RED) Data

Search notes, products, and creator profiles on Xiaohongshu (小红书), China's largest social commerce platform.

## When to Use

- User asks about product reviews or recommendations on Xiaohongshu
- User wants to find trending products or content on RED
- User shares a Xiaohongshu link and wants note/product details
- User needs influencer/creator data for marketing
- User asks about Chinese consumer trends and lifestyle content

## Important: Compliance Notice

This tool accesses publicly available data on Xiaohongshu. Users are responsible for:
- Complying with Xiaohongshu's Terms of Service
- Respecting content creators' intellectual property
- Using data for personal research purposes only
- Not scraping at excessive rates (recommended: max 1 request per 2 seconds)

## MCP Server Setup

```json
{
  "mcpServers": {
    "xiaohongshu-data": {
      "command": "npx",
      "args": ["-y", "@shopme/xiaohongshu-data-mcp"],
      "env": {
        "XHS_COOKIE": "your-xiaohongshu-cookie"
      }
    }
  }
}
```

### How to Get XHS_COOKIE
1. Open https://www.xiaohongshu.com in your browser
2. Log in to your account
3. Open DevTools (F12) → Application → Cookies
4. Copy the full cookie string
5. Cookie expires periodically; you may need to refresh it

## Available Tools

### search_notes
Search Xiaohongshu notes by keyword.
- `keyword`: Search term (Chinese works best)
- `sort`: "general" (default), "popularity" (most liked), "latest" (newest)
- `noteType`: "all", "normal" (image), "video"
- Returns: notes with title, engagement metrics, images, author info

### get_note_detail
Get full details of a specific note.
- `noteId`: 24-character hex note ID
- Returns: full note content, engagement metrics, images/video, tags

### search_xhs_products
Search products on Xiaohongshu Mall.
- `keyword`: Product search term
- Returns: products with prices, images, sales, ratings

### get_creator_info
Get creator/influencer profile information.
- `userId`: 24-character hex user ID
- Returns: follower count, note count, likes, verification status

### parse_xhs_url
Parse a Xiaohongshu URL to extract note/product/user ID.
- `url`: Any Xiaohongshu link
- Returns: type (note/product/user), extracted ID, next step hint

## Understanding Xiaohongshu Data

### Engagement Metrics
| Metric | Chinese | What It Means |
|--------|---------|---------------|
| Likes (点赞) | 点赞数 | User appreciation |
| Collects (收藏) | 收藏数 | "Bookmarked" - strong purchase intent signal |
| Comments (评论) | 评论数 | Discussion and engagement |
| Shares (分享) | 分享数 | Viral potential |

### Key Insight
**Collect-to-Like Ratio** is the most important metric:
- > 50%: Extremely high purchase intent (product is highly desired)
- 20-50%: Good commercial potential
- < 20%: More entertainment value than purchase intent

### Content Types
- **Normal notes (图文笔记)**: Image-based posts, often product reviews
- **Video notes (视频笔记)**: Video content, tutorials, unboxings
- **Product notes**: Directly linked to Xiaohongshu Mall products

### Search Tips
1. Use **Chinese keywords** for best results (e.g., "平价护肤" not "affordable skincare")
2. Sort by **popularity** to find viral content
3. Sort by **latest** to find trending new products
4. Check **tags** for related search terms

## Platform Context

Xiaohongshu has 300M+ monthly active users:
- Primary demographic: Women aged 18-35 in China
- Content focus: Beauty, fashion, lifestyle, food, travel
- Unique feature: Deep integration of content and commerce
- Trust factor: User-generated reviews are highly trusted by Chinese consumers
