---
name: logistics-tracking
description: >
  Track international packages by tracking number. Supports 3100+ carriers via 17track.
  Works without API key (uses Playwright browser), or with TRACK17_API_KEY for faster results.
  Use when the user asks about package tracking, shipment status, delivery time, or logistics queries.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopme/logistics-tracking-mcp"
---

# Logistics Tracking（国际物流追踪）

Track international packages by tracking number. Supports 3100+ carriers (China Post, DHL, FedEx, UPS, Yanwen, Cainiao, SF Express, etc.).

## When to Use

- User asks "where is my package" or provides a tracking number
- User needs to check shipment status or delivery estimate
- User asks about customs clearance or logistics exceptions
- User needs to track multiple packages at once

## How It Works

| Mode | Requirements | Speed | Stability |
|------|-------------|-------|-----------|
| **With API Key** | `TRACK17_API_KEY` | Fast (~2s) | Stable |
| **Without Key** | `playwright` + chromium | Slower (~10s) | Stable |

- **With key**: calls 17track official API directly — fastest and most reliable.
- **Without key**: uses Playwright to open a real browser, navigate to 17track, and capture the tracking data — bypasses all anti-bot checks.

## Quick Start (no API key needed)

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

After first install, run once to download the browser:

```bash
npx playwright install chromium
```

That's it. Now you can track packages by just providing a tracking number.

## With API Key (faster, recommended for heavy use)

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

Get a free API key at https://api.17track.net

## HTTP Server Mode (users connect via URL, no key needed on their side)

Deploy with your API key, let users connect key-free:

```bash
export TRACK17_API_KEY=your-key
npx -y @shopme/logistics-tracking-mcp serve
# Listening on http://0.0.0.0:3000/mcp
```

User config:

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

## Available Tools

### track_package
Query tracking info for a single package.
- Input: `trackingNumber` (required), `carrier` (optional), `language` (en/zh)
- Returns: status, current location, timeline of events

### detect_carrier
Identify the carrier from a tracking number's format.
- Input: `trackingNumber`
- Returns: carrier name, confidence level

### batch_track
Track up to 40 packages at once.
- Input: `trackingNumbers` array, `language`
- Returns: array of tracking results

### explain_status
Get a human-readable explanation of a tracking status code.
- Input: `statusCode` (e.g. InTransit, CustomsClearance)
- Returns: English and Chinese explanation with advice

## Tracking Number Format Guide

| Pattern | Carrier | Example |
|---------|---------|---------|
| `XX123456789CN` | China Post | LX123456789CN |
| `EX123456789CN` | China EMS | EA123456789CN |
| `YT + 16 digits` | Yanwen | YT1234567890123456 |
| `LP + 14+ digits` | Cainiao | LP12345678901234 |
| `SF + 12+ digits` | SF Express | SF1234567890123 |
| `1Z + 16 chars` | UPS | 1ZABCDEF1234567890 |
| `94/93/92 + 20 digits` | USPS | 9400111899223100012345 |
| `10-11 digits` | DHL | 1234567890 |
| `12-15 digits` | FedEx | 123456789012 |

## Typical Delivery Times (International)

| Route | Standard | Express |
|-------|----------|---------|
| China to US | 15-30 days | 5-10 days |
| China to EU | 15-30 days | 5-10 days |
| China to SE Asia | 7-15 days | 3-7 days |
| China to Japan/Korea | 5-10 days | 3-5 days |

## Status Codes

- **InfoReceived**: Carrier has the info but hasn't picked up the package
- **InTransit**: Package is moving through the logistics network
- **CustomsClearance**: Going through customs (3-7 business days typical)
- **OutForDelivery**: Final delivery attempt today
- **Delivered**: Successfully delivered
- **Exception**: Problem occurred (customs hold, wrong address, failed delivery)
- **Returned**: Being sent back to origin

## Tips

1. Run `npx playwright install chromium` once after install for no-key tracking.
2. With API key, supports 3100+ carriers with auto-detection.
3. Query 24-48 hours after shipping to avoid empty results.
4. Wait at least 2 hours between queries for the same number.
5. Use `batch_track` for multiple packages — more efficient.
