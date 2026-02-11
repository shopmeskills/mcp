---
name: product-recommendation
description: >
  AI-powered product scoring, similarity comparison, and alternative recommendations for cross-border e-commerce.
  Score product quality, compare similar products, find alternatives, and rank products by multiple dimensions.
  Use when the user asks for product recommendations, quality assessment, product comparison, or alternative suggestions.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopme/product-recommendation-mcp"
---

# Product Recommendation & Quality Scoring

AI-powered product evaluation, similarity comparison, and alternative recommendations for cross-border e-commerce.

## When to Use

- User asks "is this product any good?"
- User wants to compare two similar products
- User asks for alternative or similar products
- User has a list of products and wants them ranked
- User asks about product quality signals on Chinese platforms
- User needs help deciding which product to buy

## MCP Server Setup

```json
{
  "mcpServers": {
    "product-recommendation": {
      "command": "npx",
      "args": ["-y", "@shopme/product-recommendation-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

`GEMINI_API_KEY` is only required for `recommend_alternatives`. Other tools work without it.

## Available Tools

### score_product
Evaluate a product on multiple quality dimensions.
- Input: Product data (name, price, rating, soldCount, reviewCount, shopRating, platform)
- Optional: `averagePrice` for value comparison
- Returns: Overall score (0-100), dimension scores, analysis, verdict

### find_similar
Compare two products for similarity.
- Input: Two product objects
- Returns: Similarity score (0-1), matched features, differences, recommendation

### recommend_alternatives
Get AI-powered alternative product suggestions.
- Input: Product name, optional category/budget/preferences
- Returns: 3-5 alternative suggestions with search keywords and platforms
- **Requires**: GEMINI_API_KEY

### rank_products
Batch score and rank multiple products.
- Input: Array of products (2-20)
- Returns: Ranked list with scores and top pick

## Scoring Dimensions Explained

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Quality** | 30% | Buyer ratings and reviews |
| **Price Value** | 25% | Price relative to market average |
| **Popularity** | 25% | Sales volume and review count |
| **Trustworthiness** | 20% | Shop rating, images, description quality |

### Score Interpretation

| Score | Verdict | Meaning |
|-------|---------|---------|
| 80-100 | Excellent | Safe to buy with confidence |
| 65-79 | Good | Solid choice, minor concerns |
| 50-64 | Average | Acceptable but has trade-offs |
| 35-49 | Poor | Significant concerns |
| 0-34 | Risky | Avoid or proceed with extreme caution |

## Quality Signals on Chinese E-commerce

### Positive Signals
- Rating ≥ 4.8 with 1000+ reviews → Highly trustworthy
- Sold 10,000+ units → Battle-tested product
- Shop rating ≥ 4.8 → Reliable seller
- Multiple detailed images → Professional listing
- Tmall brand store → Official/authorized

### Red Flags
- No reviews → Too new or fake listing
- Rating < 3.5 → Known issues
- Price is >50% below average → Possible quality issues or counterfeit
- Stock photos only → May not match actual product
- New shop with 0 ratings → Higher risk

## Recommendation Workflow

### For a single product decision:
1. `score_product` → Get quality assessment
2. If score < 65, use `recommend_alternatives` → Get better options
3. Search for alternatives using suggested keywords

### For choosing between options:
1. `rank_products` with all candidates → Get ranked list
2. `find_similar` on top 2 → Understand key differences
3. Choose based on your priorities (price vs quality vs shipping)
