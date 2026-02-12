# Shopme MCP Servers & Agent Skills

Cross-border e-commerce toolkit for AI agents. Provides MCP servers (tools) and Agent Skills (knowledge) for logistics tracking, product search, price comparison, and more.

## Available Skills

Install all skills at once:

```bash
npx skills add shopmeskills/mcp
```

| Skill | Description |
|-------|-------------|
| `logistics-tracking` | International package tracking with carrier detection |
| `cn-ecommerce-search` | Search products on Taobao, 1688, AliExpress |
| `visual-product-search` | Find products by image across Chinese e-commerce |
| `xiaohongshu-data` | Search notes, products, and creators on Xiaohongshu (RED) |
| `cross-border-price-compare` | Compare prices across platforms with landed cost estimation |
| `product-recommendation` | Find similar products and get quality scores |

## Available MCP Servers

Each skill has a companion MCP server that provides executable tools:

```bash
# Example: use the logistics tracking MCP server
npx -y @shopme/logistics-tracking-mcp
```

### Configuration

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

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Develop a specific package
cd packages/logistics-tracking-mcp
pnpm dev
```

## Publishing

Skills are automatically discovered by Skills.sh when pushed to GitHub.

For ClawHub:

```bash
npm i -g clawdhub
clawdhub login
clawdhub sync
```

## License

MIT
