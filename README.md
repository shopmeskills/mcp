# Shopme MCP Servers & Agent Skills

Cross-border e-commerce toolkit for AI agents. Provides MCP servers (tools) and Agent Skills (knowledge).

---

## Logistics Tracking (3100+ carriers)

Track international packages by tracking number. Powered by 17track — supports 3100+ carriers worldwide.

### Option A: Deploy as HTTP service (users need no key)

Set `TRACK17_API_KEY` on your server and run the HTTP service. End users connect via URL with no key required:

```bash
export TRACK17_API_KEY=your-17track-api-key
npx -y @shopmeagent/logistics-tracking-mcp serve
# Default: http://0.0.0.0:3000/mcp (override with PORT, HOST)
```

Client MCP config (Streamable HTTP):

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "type": "streamable-http",
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

See `skills/logistics-tracking/SKILL.md` for full details.

### Option B: Local stdio (zero-config or with key)

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "command": "npx",
      "args": ["-y", "@shopmeagent/logistics-tracking-mcp"]
    }
  }
}
```

### Recommended: add a 17track API key for better coverage

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "command": "npx",
      "args": ["-y", "@shopmeagent/logistics-tracking-mcp"],
      "env": {
        "TRACK17_API_KEY": "your-17track-api-key"
      }
    }
  }
}
```

Free API key: https://api.17track.net

### Install Skill

```bash
npx skills add shopmeskills/mcp
```

### Available Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a single package by tracking number |
| `detect_carrier` | Identify carrier from tracking number format |
| `batch_track` | Track up to 40 packages at once |
| `explain_status` | Explain tracking status codes |

### Supported Carriers

China Post, China EMS, SF Express, Yanwen, Cainiao, YTO, STO, ZTO, Yunda, Best Express, DHL, FedEx, UPS, USPS, Royal Mail, Japan Post, Korea Post, Australia Post, Singapore Post, Hong Kong Post, Aramex, DPD, and more.

---

## CN E-commerce Search (Taobao, Tmall, XHS)

Search products across Chinese e-commerce platforms via Shopme unified database. **Zero-config — no API keys required.**

Supported: Taobao (淘宝), Tmall (天猫), XHS (小红书)

```json
{
  "mcpServers": {
    "cn-ecommerce-search": {
      "command": "npx",
      "args": ["-y", "@shopmeagent/cn-ecommerce-search-mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `search_products` | Search by keyword, filter by platform, sort by price/sales/relevance |
| `get_product_detail` | Get full details by product ID or URL |
| `parse_product_link` | Parse product URL to identify platform and ID |

See `skills/cn-ecommerce-search/SKILL.md` for full details.

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Develop logistics MCP
cd packages/logistics-tracking-mcp && pnpm dev

# Develop CN e-commerce search MCP
cd packages/cn-ecommerce-search-mcp && pnpm dev
```

## Upcoming Skills (in development)

- `visual-product-search` — Find products by image
- `cross-border-price-compare` — Price comparison with landed cost
- `product-recommendation` — AI-powered product scoring

## License

MIT
