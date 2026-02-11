/**
 * Carrier detection patterns for international tracking numbers.
 */
export const CARRIER_PATTERNS: Record<string, RegExp> = {
  "china-post": /^[A-Z]{2}\d{9}CN$/i,
  "china-ems": /^E[A-Z]\d{9}CN$/i,
  yanwen: /^YT\d{16}$/i,
  cainiao: /^LP\d{14,}$/i,
  "sf-express": /^SF\d{12,}$/i,
  yto: /^YT\d{13,}$/i,
  sto: /^\d{13}$/,
  zto: /^(ZTO|7)\d{11,}$/i,
  yunda: /^\d{13}$/,
  "best-express": /^\d{12,15}$/,
  dhl: /^\d{10,11}$/,
  fedex: /^\d{12,15}$/,
  ups: /^1Z[A-Z0-9]{16}$/i,
  usps: /^(94|93|92|95)\d{20,22}$/,
  "royal-mail": /^[A-Z]{2}\d{9}GB$/i,
  "japan-post": /^[A-Z]{2}\d{9}JP$/i,
  "korea-post": /^[A-Z]{2}\d{9}KR$/i,
  "australia-post": /^[A-Z]{2}\d{9}AU$/i,
  "singapore-post": /^[A-Z]{2}\d{9}SG$/i,
  "hong-kong-post": /^[A-Z]{2}\d{9}HK$/i,
  aramex: /^\d{10}$/,
  dpd: /^\d{14}$/,
};

/**
 * Detect carrier from tracking number pattern.
 */
export function detectCarrier(trackingNumber: string): string {
  const trimmed = trackingNumber.trim();

  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(trimmed)) {
      return carrier;
    }
  }

  // Country suffix detection for generic international formats
  const countryMatch = trimmed.match(/^[A-Z]{2}\d{9}([A-Z]{2})$/i);
  if (countryMatch) {
    const countryCode = countryMatch[1].toUpperCase();
    const countryCarriers: Record<string, string> = {
      CN: "china-post",
      US: "usps",
      GB: "royal-mail",
      JP: "japan-post",
      KR: "korea-post",
      AU: "australia-post",
      SG: "singapore-post",
      HK: "hong-kong-post",
    };
    if (countryCarriers[countryCode]) {
      return countryCarriers[countryCode];
    }
    return `post-${countryCode.toLowerCase()}`;
  }

  return "unknown";
}
