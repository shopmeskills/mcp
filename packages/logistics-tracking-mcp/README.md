# @shopmeagent/logistics-tracking-mcp

MCP server for international package tracking. Supports 3100+ carriers via [17track](https://www.17track.net).

## Quick Start

**Zero-config** (uses Playwright headless browser when no API key is set):

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

**Recommended** — with 17track API key for best reliability:

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

## HTTP Server Mode

Deploy with your API key so clients connect via URL without needing their own key:

```bash
export TRACK17_API_KEY=your-key
npx -y @shopmeagent/logistics-tracking-mcp serve
# Listening at http://0.0.0.0:3000/mcp
```

Client config:

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

## Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a single package by tracking number |
| `detect_carrier` | Identify carrier from tracking number format |
| `batch_track` | Track up to 40 packages at once |
| `explain_status` | Explain tracking status codes |

## Supported Carriers

China Post, China EMS, SF Express, Yanwen, Cainiao, YTO, STO, ZTO, Yunda, Best Express, DHL, FedEx, UPS, USPS, Royal Mail, Japan Post, Korea Post, Australia Post, Singapore Post, Hong Kong Post, Aramex, DPD, and 3000+ more via 17track.

## License

MIT
