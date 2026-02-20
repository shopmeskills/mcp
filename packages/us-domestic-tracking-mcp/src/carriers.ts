/**
 * US domestic carrier detection (UPS, USPS, FedEx).
 * No international/cross-border patterns (use logistics-tracking-mcp for that).
 */
export const CARRIER_PATTERNS: Record<string, RegExp> = {
  usps: /^(94|93|92|95)\d{20,22}$/,
  ups: /^1Z[A-Z0-9]{16}$/i,
  fedex: /^\d{12,15}$/,
};

export type DomesticCarrier = "usps" | "ups" | "fedex";

export function detectCarrier(trackingNumber: string): string {
  const trimmed = trackingNumber.trim().replace(/\s/g, "");
  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(trimmed)) return carrier;
  }
  return "unknown";
}

export function isSupportedCarrier(carrier: string): carrier is DomesticCarrier {
  return carrier === "usps" || carrier === "ups" || carrier === "fedex";
}
