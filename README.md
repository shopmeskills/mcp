# Shopme MCP Servers & Agent Skills

Cross-border e-commerce toolkit for AI agents. Provides MCP servers (tools) and Agent Skills (knowledge).

## 🚚 Logistics Tracking

Track international packages across 20+ carriers with auto-detection.

### Install Skill

```bash
npx skills add shopmeskills/mcp
```

### MCP Server Setup

Add to your `.cursor/mcp.json`, `claude_desktop_config.json`, or equivalent:

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "command": "npx",
      "args": ["-y", "@shopme/logistics-tracking-mcp"],
      "env": {
        "TRACK17_API_KEY": "your-api-key"
      }
    }
  }
}
```

Get a free 17track API key at https://api.17track.net

### Available Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a single package by tracking number |
| `detect_carrier` | Identify carrier from tracking number format |
| `batch_track` | Track up to 40 packages at once |
| `explain_status` | Explain tracking status codes in English and Chinese |

### Supported Carriers

China Post, China EMS, SF Express, Yanwen, Cainiao, YTO, STO, ZTO, Yunda, Best Express, DHL, FedEx, UPS, USPS, Royal Mail, Japan Post, Korea Post, Australia Post, Singapore Post, Hong Kong Post, Aramex, DPD, and more.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Develop
cd packages/logistics-tracking-mcp
pnpm dev
```

## Upcoming Skills (in development)

- `cn-ecommerce-search` — Search products on Taobao, 1688, AliExpress
- `visual-product-search` — Find products by image
- `xiaohongshu-data` — Xiaohongshu note and product search
- `cross-border-price-compare` — Price comparison with landed cost
- `product-recommendation` — AI-powered product scoring

## License

MIT
