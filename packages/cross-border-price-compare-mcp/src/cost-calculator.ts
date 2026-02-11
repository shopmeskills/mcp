/**
 * Landed cost calculator for cross-border e-commerce.
 * Estimates total cost including product price, shipping, and duties.
 */

export interface ShippingEstimate {
  method: string;
  daysMin: number;
  daysMax: number;
  cost: number;
  currency: string;
}

export interface LandedCost {
  productPrice: number;
  productPriceUsd: number;
  shipping: ShippingEstimate;
  estimatedDuty: number;
  estimatedTax: number;
  totalLandedCost: number;
  currency: string;
  breakdown: {
    item: string;
    amount: number;
    note?: string;
  }[];
}

// Approximate exchange rate (CNY to USD)
const CNY_USD_RATE = 0.139;

// Shipping cost estimates per kg by method
const SHIPPING_RATES: Record<
  string,
  { perKg: number; baseFee: number; daysMin: number; daysMax: number }
> = {
  economy: { perKg: 5, baseFee: 3, daysMin: 15, daysMax: 30 },
  standard: { perKg: 10, baseFee: 5, daysMin: 10, daysMax: 20 },
  express: { perKg: 20, baseFee: 10, daysMin: 5, daysMax: 10 },
  premium: { perKg: 35, baseFee: 15, daysMin: 3, daysMax: 7 },
};

// Common duty rates by category (approximate, for estimation only)
const DUTY_RATES: Record<string, number> = {
  electronics: 0.0,
  clothing: 0.12,
  shoes: 0.20,
  accessories: 0.08,
  cosmetics: 0.065,
  toys: 0.0,
  jewelry: 0.065,
  bags: 0.20,
  furniture: 0.0,
  general: 0.05,
};

// Tax rates by destination country
const TAX_RATES: Record<string, number> = {
  US: 0.0, // No federal VAT, varies by state
  GB: 0.20,
  EU: 0.21, // Average EU VAT
  CA: 0.05, // GST only
  AU: 0.10,
  JP: 0.10,
  KR: 0.10,
  SG: 0.09,
  HK: 0.0,
  TW: 0.05,
};

/**
 * Estimate shipping cost based on weight and method.
 */
export function estimateShipping(
  weightKg: number,
  method: string = "standard",
  destination: string = "US",
): ShippingEstimate {
  const rate = SHIPPING_RATES[method] || SHIPPING_RATES.standard;
  const weight = Math.max(weightKg, 0.5); // Minimum 0.5kg

  // Adjust for destination
  let multiplier = 1.0;
  if (["AU", "EU", "GB"].includes(destination)) multiplier = 1.2;
  if (["JP", "KR", "SG", "HK", "TW"].includes(destination)) multiplier = 0.8;

  return {
    method,
    daysMin: rate.daysMin,
    daysMax: rate.daysMax,
    cost: Math.round((rate.baseFee + rate.perKg * weight) * multiplier * 100) / 100,
    currency: "USD",
  };
}

/**
 * Calculate estimated landed cost for a product.
 */
export function calculateLandedCost(options: {
  priceCny?: number;
  priceUsd?: number;
  weightKg?: number;
  category?: string;
  destination?: string;
  shippingMethod?: string;
}): LandedCost {
  const {
    priceCny,
    priceUsd,
    weightKg = 0.5,
    category = "general",
    destination = "US",
    shippingMethod = "standard",
  } = options;

  // Determine product price in USD
  let productPriceUsd: number;
  let productPrice: number;

  if (priceUsd !== undefined) {
    productPriceUsd = priceUsd;
    productPrice = priceUsd;
  } else if (priceCny !== undefined) {
    productPriceUsd = Math.round(priceCny * CNY_USD_RATE * 100) / 100;
    productPrice = priceCny;
  } else {
    throw new Error("Either priceCny or priceUsd must be provided");
  }

  // Shipping
  const shipping = estimateShipping(weightKg, shippingMethod, destination);

  // Duty
  const dutyRate = DUTY_RATES[category] || DUTY_RATES.general;
  const estimatedDuty =
    productPriceUsd > 800 // US de minimis threshold
      ? Math.round(productPriceUsd * dutyRate * 100) / 100
      : 0;

  // Tax/VAT
  const taxRate = TAX_RATES[destination] || 0;
  const taxableAmount = productPriceUsd + shipping.cost + estimatedDuty;
  const estimatedTax = Math.round(taxableAmount * taxRate * 100) / 100;

  // Total
  const totalLandedCost =
    Math.round((productPriceUsd + shipping.cost + estimatedDuty + estimatedTax) * 100) /
    100;

  const breakdown = [
    { item: "Product Price", amount: productPriceUsd },
    {
      item: `Shipping (${shippingMethod})`,
      amount: shipping.cost,
      note: `${shipping.daysMin}-${shipping.daysMax} days`,
    },
  ];

  if (estimatedDuty > 0) {
    breakdown.push({
      item: `Import Duty (${(dutyRate * 100).toFixed(1)}%)`,
      amount: estimatedDuty,
      note: `${category} category`,
    });
  } else {
    breakdown.push({
      item: "Import Duty",
      amount: 0,
      note: destination === "US" ? "Below $800 de minimis" : "Duty-free category",
    });
  }

  if (estimatedTax > 0) {
    breakdown.push({
      item: `Tax/VAT (${(taxRate * 100).toFixed(1)}%)`,
      amount: estimatedTax,
      note: `${destination} rate`,
    });
  }

  breakdown.push({ item: "Total Landed Cost", amount: totalLandedCost });

  return {
    productPrice,
    productPriceUsd,
    shipping,
    estimatedDuty,
    estimatedTax,
    totalLandedCost,
    currency: "USD",
    breakdown,
  };
}

/**
 * Compare prices from multiple sources and rank by total cost.
 */
export function rankByLandedCost(
  sources: Array<{
    platform: string;
    productName: string;
    priceCny?: number;
    priceUsd?: number;
    weightKg?: number;
  }>,
  options: {
    category?: string;
    destination?: string;
    shippingMethod?: string;
  } = {},
): Array<{
  rank: number;
  platform: string;
  productName: string;
  landedCost: LandedCost;
  savings?: number;
}> {
  const results = sources.map((source) => ({
    platform: source.platform,
    productName: source.productName,
    landedCost: calculateLandedCost({
      priceCny: source.priceCny,
      priceUsd: source.priceUsd,
      weightKg: source.weightKg,
      ...options,
    }),
  }));

  // Sort by total landed cost
  results.sort(
    (a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost,
  );

  const cheapest = results[0]?.landedCost.totalLandedCost || 0;

  return results.map((r, i) => ({
    rank: i + 1,
    ...r,
    savings:
      i === 0
        ? undefined
        : Math.round((r.landedCost.totalLandedCost - cheapest) * 100) / 100,
  }));
}
