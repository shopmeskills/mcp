---
name: us-domestic-tracking
description: >
  Query US domestic and key EU courier logistics (UPS, USPS, FedEx) for government and enterprise use.
  Uses official carrier APIs only—no third-party aggregators. Designed for use in OpenClaw and other MCP clients.
  Use when the user needs to track US domestic packages, government shipments, or USPS/UPS/FedEx status.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopmeagent/us-domestic-tracking-mcp"
---

# US Domestic & Government Logistics Tracking

Track packages via **US domestic carriers** (UPS, USPS, FedEx) using **official APIs only**. Intended for US and European government or enterprise deployments (e.g. OpenClaw).

## When to Use

- User asks about **US domestic** package tracking (UPS, USPS, FedEx)
- **Government or enterprise** context: official data only, no third-party aggregators
- User works in **OpenClaw** or another MCP client and needs logistics tools
- User has or will configure **USPS / UPS API credentials**

## When NOT to Use

- **International / cross-border** tracking (China Post, Yanwen, Cainiao, etc.) → use `logistics-tracking` skill and `@shopmeagent/logistics-tracking-mcp` instead
- User has no API keys and expects a “no-key” fallback → this server requires official credentials

## MCP Server Setup (OpenClaw)

Add the server to your OpenClaw MCP config (or `mcp.json` / `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "us-domestic-tracking": {
      "command": "npx",
      "args": ["-y", "@shopmeagent/us-domestic-tracking-mcp"],
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

- **USPS**: Get OAuth credentials at [developers.usps.com](https://developers.usps.com) (Tracking 3.2). Legacy Web Tools APIs shut down January 2026.
- **UPS**: Get OAuth credentials at [developer.ups.com](https://developer.ups.com) (Tracking API).

At least one of USPS or UPS credentials must be set to track that carrier.

## Available Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a single package by tracking number (UPS, USPS, FedEx). |
| `detect_carrier` | Identify carrier from tracking number format (US domestic patterns). |
| `batch_track` | Track multiple packages in one call. |
| `explain_status` | Explain tracking status codes in plain language. |

## Supported Carriers (US Domestic Focus)

| Carrier | Tracking number examples | API |
|---------|---------------------------|-----|
| **USPS** | 94/93/92/95 + 20–22 digits | USPS Tracking 3.2 (OAuth) |
| **UPS** | 1Z + 16 alphanumeric | UPS Tracking API (OAuth) |
| **FedEx** | 12–15 digits | FedEx API (when configured) |

## Tracking Number Format Guide (US)

| Pattern | Carrier | Example |
|---------|---------|---------|
| `1Z` + 16 chars | UPS | 1Z999AA10123456784 |
| `94/93/92/95` + 20–22 digits | USPS | 9400111899223100012345 |
| 12–15 digits | FedEx | 123456789012 |

## Status Codes (aligned with US carrier terminology)

- **InfoReceived** — Shipment info received; not yet picked up
- **InTransit** — In transit
- **CustomsClearance** — Customs (international mail only)
- **OutForDelivery** — Out for delivery today
- **Delivered** — Delivered
- **Exception** — Delivery exception (hold, failed attempt, etc.)
- **Returned** — Return to sender

## OpenClaw Notes

1. OpenClaw discovers MCP tools via your MCP config; ensure `us-domestic-tracking` is listed there.
2. Use **HTTP/SSE** or **stdio** transport as your OpenClaw setup supports; this server uses stdio by default when run via `npx`.
3. For government deployments, use official carrier credentials only; do not add 17track or other third-party keys to this server.

## Install Skill

```bash
npx skills add shopmeskills/mcp
```

(Install from the repo that includes the `us-domestic-tracking` skill.)
