---
name: visual-product-search
description: >
  Find products by image across Chinese e-commerce platforms (Taobao, AliExpress).
  Upload or provide an image URL to search for matching products. Extract product info from screenshots using AI vision.
  Use when the user provides a product image and wants to find it online, or wants to identify a product from a photo.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopme/visual-product-search-mcp"
---

# Visual Product Search

Find products by image across Chinese e-commerce platforms. Powered by Taobao Image Search, AliExpress Image Search, and Google Gemini Vision.

## When to Use

- User shares a product photo and asks "where can I buy this?"
- User wants to find similar products from an image
- User has a screenshot of a product and wants to find it on Taobao/AliExpress
- User wants to identify a product from a photo (brand, price estimate, category)
- User provides a product image URL and asks to search

## MCP Server Setup

```json
{
  "mcpServers": {
    "visual-product-search": {
      "command": "npx",
      "args": ["-y", "@shopme/visual-product-search-mcp"],
      "env": {
        "TAOBAO_APP_KEY": "your-key",
        "TAOBAO_APP_SECRET": "your-secret",
        "TAOBAO_ACCESS_TOKEN": "your-token",
        "ALIEXPRESS_DS_KEY": "your-key",
        "ALIEXPRESS_DS_SECRET": "your-secret",
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

## Available Tools

### search_by_image
Search products using an image URL.
- `imageUrl`: Public URL of the product image
- `platform`: "taobao", "aliexpress", or "all"
- Returns: matching products with prices and similarity scores

### search_by_image_upload
Upload a base64-encoded image and search.
- `imageBase64`: Base64 image data (no data URI prefix)
- `platform`: Target platform(s)
- Uploads to Taobao CDN first, then searches

### extract_product_from_image
Analyze an image with AI to extract product information.
- `imageUrl`: Product image or screenshot URL
- `language`: "en" or "zh"
- Returns: product name, category, suggested search terms, detected text, price estimate

## Image Quality Guidelines

For best search results:
1. **Clear, well-lit photos** - avoid blurry or dark images
2. **Single product focus** - crop to show just the product
3. **White/plain background** preferred - reduces noise
4. **High resolution** - at least 300x300 pixels
5. **No watermarks** - they interfere with matching

## Workflow Recommendations

### Finding a product from an image
1. Use `extract_product_from_image` to get AI analysis and search terms
2. Use `search_by_image` for visual matching on Taobao and AliExpress
3. Cross-reference results from both approaches for best accuracy

### Finding the cheapest source
1. Run `search_by_image` with `platform: "all"`
2. Compare prices between Taobao and AliExpress results
3. Taobao results are in CNY, AliExpress in USD (1 USD ≈ 7.2 CNY)

## Platform Comparison for Image Search

| Feature | Taobao | AliExpress |
|---------|--------|------------|
| Accuracy | High (Chinese products) | Good (branded items) |
| Speed | Fast | Moderate |
| Coverage | Best for Chinese brands | Best for international |
| Price Display | CNY | USD |
