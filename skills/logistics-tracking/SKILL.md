---
name: logistics-tracking
description: >
  Track international packages across 20+ carriers including China Post, DHL, FedEx, UPS, Yanwen, and Cainiao.
  Detect carrier from tracking number format. Explain logistics statuses like customs clearance, transit, and delivery exceptions.
  Use when the user asks about package tracking, shipment status, delivery time, or logistics queries.
license: MIT
metadata:
  author: shopme
  version: "1.0.0"
  mcp-server: "@shopme/logistics-tracking-mcp"
---

# International Logistics Tracking

Track packages across borders with carrier auto-detection and status explanation.

## When to Use

- User asks "where is my package" or provides a tracking number
- User needs to check shipment status or delivery estimate
- User asks about customs clearance or logistics exceptions
- User needs to track multiple packages at once

## MCP Server Setup

This skill works best with the companion MCP server. Add to your MCP config:

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

Get a free 17track API key at https://api.17track.net

Install this skill: `npx skills add shopmeskills/shopme-mcp`

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

## Status Codes Explained

- **InfoReceived**: Carrier has the info but hasn't picked up the package (1-3 day wait)
- **InTransit**: Package is moving through the logistics network
- **CustomsClearance**: Going through customs (3-7 business days typical)
- **OutForDelivery**: Final delivery attempt today
- **Delivered**: Successfully delivered
- **Exception**: Problem occurred (customs hold, wrong address, failed delivery)
- **Returned**: Being sent back to origin

## Tips

1. If `TRACK17_API_KEY` is not set, the server falls back to RTB56 (limited accuracy)
2. For best results, wait 24-48 hours after shipping before first query
3. Query no more than once every 2 hours per tracking number to avoid rate limits
4. Batch tracking is more efficient for multiple packages
