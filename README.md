# Shopme MCP Servers & Agent Skills

Cross-border e-commerce toolkit for AI agents. Provides MCP servers (tools) and Agent Skills (knowledge).

---

## 🌐 International Logistics Tracking

Track packages from **3100+ carriers** worldwide (China Post, DHL, FedEx, UPS, Yanwen, Cainiao, SF Express, etc.) via 17track.

**Two modes:**
- **Without API key**: uses Playwright (headless browser) to fetch tracking data — just install and go.
- **With `TRACK17_API_KEY`**: calls 17track official API — faster and more reliable for heavy use.

### Quick Start (no API key)

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "command": "npx",
      "args": ["-y", "@shopme/logistics-tracking-mcp"]
    }
  }
}
```

After first install, download the browser once:

```bash
npx playwright install chromium
```

### With API Key (recommended for heavy use)

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "command": "npx",
      "args": ["-y", "@shopme/logistics-tracking-mcp"],
      "env": {
        "TRACK17_API_KEY": "your-17track-api-key"
      }
    }
  }
}
```

Free API key: https://api.17track.net

### HTTP Server Mode (deploy once, users need no key)

```bash
export TRACK17_API_KEY=your-key
npx -y @shopme/logistics-tracking-mcp serve
# http://0.0.0.0:3000/mcp
```

Users connect via Streamable HTTP:

```json
{
  "mcpServers": {
    "logistics-tracking": {
      "type": "streamable-http",
      "url": "https://your-server.com/mcp"
    }
  }
}
```

See `skills/logistics-tracking/SKILL.md` for full documentation.

---

## 🚚 US Domestic Tracking (Government / Enterprise)

Track **US domestic** packages (UPS, USPS) via **official APIs only**. No third-party aggregators. Designed for OpenClaw and government deployments.

```json
{
  "mcpServers": {
    "us-domestic-tracking": {
      "command": "npx",
      "args": ["-y", "@shopme/us-domestic-tracking-mcp"],
      "env": {
        "USPS_CONSUMER_KEY": "your-usps-consumer-key",
        "USPS_CONSUMER_SECRET": "your-usps-consumer-secret",
        "UPS_CLIENT_ID": "your-ups-client-id",
        "UPS_CLIENT_SECRET": "your-ups-client-secret"
      }
    }
  }
}
```

- **USPS**: [developers.usps.com](https://developers.usps.com) (Tracking 3.2, OAuth)
- **UPS**: [developer.ups.com](https://developer.ups.com) (Tracking API, OAuth)

See `skills/us-domestic-tracking/SKILL.md` for details.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a single package by tracking number |
| `detect_carrier` | Identify carrier from tracking number format |
| `batch_track` | Track up to 40 packages at once |
| `explain_status` | Explain tracking status codes in English and Chinese |

## Supported Carriers

China Post, China EMS, SF Express, Yanwen, Cainiao, YTO, STO, ZTO, Yunda, Best Express, DHL, FedEx, UPS, USPS, Royal Mail, Japan Post, Korea Post, Australia Post, Singapore Post, Hong Kong Post, Aramex, DPD, and more.

## Development

```bash
pnpm install
pnpm build

# Develop international logistics MCP
cd packages/logistics-tracking-mcp && pnpm dev

# Develop US domestic MCP
cd packages/us-domestic-tracking-mcp && pnpm dev
```

## License

MIT
