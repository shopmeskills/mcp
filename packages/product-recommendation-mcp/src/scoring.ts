/**
 * Product scoring and similarity logic.
 */

export interface ProductData {
  name: string;
  price: number;
  currency: string;
  rating?: number;
  soldCount?: number;
  reviewCount?: number;
  shopRating?: number;
  platform: string;
  category?: string;
  images?: string[];
  description?: string;
}

export interface ProductScore {
  overall: number;
  dimensions: {
    priceValue: number;
    popularity: number;
    quality: number;
    trustworthiness: number;
  };
  analysis: string;
  verdict: "excellent" | "good" | "average" | "poor" | "risky";
}

export interface SimilarityResult {
  similarity: number;
  matchedFeatures: string[];
  differences: string[];
  recommendation: string;
}

/**
 * Score a product on multiple dimensions (0-100).
 */
export function scoreProduct(
  product: ProductData,
  averagePrice?: number,
): ProductScore {
  const scores = {
    priceValue: scorePriceValue(product, averagePrice),
    popularity: scorePopularity(product),
    quality: scoreQuality(product),
    trustworthiness: scoreTrustworthiness(product),
  };

  const overall = Math.round(
    scores.priceValue * 0.25 +
      scores.popularity * 0.25 +
      scores.quality * 0.30 +
      scores.trustworthiness * 0.20,
  );

  let verdict: ProductScore["verdict"];
  if (overall >= 80) verdict = "excellent";
  else if (overall >= 65) verdict = "good";
  else if (overall >= 50) verdict = "average";
  else if (overall >= 35) verdict = "poor";
  else verdict = "risky";

  const analysis = generateAnalysis(product, scores, overall, verdict);

  return { overall, dimensions: scores, analysis, verdict };
}

function scorePriceValue(product: ProductData, averagePrice?: number): number {
  if (!averagePrice || averagePrice === 0) return 50;

  const ratio = product.price / averagePrice;
  if (ratio <= 0.3) return 40; // Suspiciously cheap
  if (ratio <= 0.6) return 85;
  if (ratio <= 0.8) return 90;
  if (ratio <= 1.0) return 75;
  if (ratio <= 1.2) return 60;
  if (ratio <= 1.5) return 45;
  return 30;
}

function scorePopularity(product: ProductData): number {
  let score = 50;

  if (product.soldCount !== undefined) {
    if (product.soldCount > 10000) score = 95;
    else if (product.soldCount > 5000) score = 85;
    else if (product.soldCount > 1000) score = 75;
    else if (product.soldCount > 100) score = 60;
    else if (product.soldCount > 10) score = 45;
    else score = 30;
  }

  if (product.reviewCount !== undefined && product.reviewCount > 0) {
    const reviewBonus = Math.min(product.reviewCount / 100, 10);
    score = Math.min(100, score + reviewBonus);
  }

  return Math.round(score);
}

function scoreQuality(product: ProductData): number {
  let score = 50;

  if (product.rating !== undefined) {
    if (product.rating >= 4.8) score = 95;
    else if (product.rating >= 4.5) score = 85;
    else if (product.rating >= 4.0) score = 70;
    else if (product.rating >= 3.5) score = 50;
    else if (product.rating >= 3.0) score = 35;
    else score = 20;
  }

  // Penalize no ratings
  if (product.rating === undefined && (product.reviewCount === undefined || product.reviewCount === 0)) {
    score = Math.max(score - 15, 20);
  }

  return Math.round(score);
}

function scoreTrustworthiness(product: ProductData): number {
  let score = 50;

  // Shop rating
  if (product.shopRating !== undefined) {
    if (product.shopRating >= 4.8) score += 20;
    else if (product.shopRating >= 4.5) score += 15;
    else if (product.shopRating >= 4.0) score += 5;
    else score -= 10;
  }

  // Has images
  if (product.images && product.images.length >= 5) score += 10;
  else if (product.images && product.images.length >= 3) score += 5;

  // Has description
  if (product.description && product.description.length > 100) score += 5;

  // Platform trust
  const platformTrust: Record<string, number> = {
    tmall: 10,
    taobao: 5,
    aliexpress: 5,
    "1688": 0,
    xhs: 5,
  };
  score += platformTrust[product.platform] || 0;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function generateAnalysis(
  product: ProductData,
  scores: ProductScore["dimensions"],
  overall: number,
  verdict: string,
): string {
  const parts: string[] = [];

  if (overall >= 80) {
    parts.push(`This ${product.category || "product"} scores ${overall}/100 - an excellent choice.`);
  } else if (overall >= 65) {
    parts.push(`This ${product.category || "product"} scores ${overall}/100 - a good option.`);
  } else if (overall >= 50) {
    parts.push(`This ${product.category || "product"} scores ${overall}/100 - an average choice.`);
  } else {
    parts.push(`This ${product.category || "product"} scores ${overall}/100 - proceed with caution.`);
  }

  if (scores.priceValue >= 80) parts.push("Great value for money.");
  else if (scores.priceValue <= 40) parts.push("Price seems unusual - verify before purchasing.");

  if (scores.popularity >= 80) parts.push("Very popular with many buyers.");
  else if (scores.popularity <= 30) parts.push("Low sales volume - limited buyer feedback.");

  if (scores.quality >= 80) parts.push("Highly rated by buyers.");
  else if (scores.quality <= 40) parts.push("Mixed or low ratings.");

  if (scores.trustworthiness <= 40) parts.push("Shop credibility is low - consider alternatives.");

  return parts.join(" ");
}

/**
 * Calculate text-based similarity between two products (0-1).
 */
export function calculateSimilarity(
  product1: ProductData,
  product2: ProductData,
): SimilarityResult {
  const matchedFeatures: string[] = [];
  const differences: string[] = [];

  // Name similarity (simple word overlap)
  const words1 = new Set(product1.name.toLowerCase().split(/[\s,./\-_]+/));
  const words2 = new Set(product2.name.toLowerCase().split(/[\s,./\-_]+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const nameSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  if (nameSimilarity > 0.5) matchedFeatures.push("Similar product names");
  else differences.push("Different product names");

  // Category match
  if (product1.category && product2.category) {
    if (product1.category === product2.category) {
      matchedFeatures.push("Same category");
    } else {
      differences.push("Different categories");
    }
  }

  // Price range similarity
  const priceDiff = Math.abs(product1.price - product2.price);
  const avgPrice = (product1.price + product2.price) / 2;
  const priceSimRatio = avgPrice > 0 ? 1 - priceDiff / avgPrice : 0;

  if (priceSimRatio > 0.8) matchedFeatures.push("Similar price range");
  else differences.push("Different price ranges");

  // Platform match
  if (product1.platform === product2.platform) {
    matchedFeatures.push("Same platform");
  } else {
    differences.push("Different platforms");
  }

  // Overall similarity
  const similarity = Math.round(
    (nameSimilarity * 0.5 + Math.max(priceSimRatio, 0) * 0.3 + (product1.category === product2.category ? 0.2 : 0)) * 100,
  ) / 100;

  let recommendation: string;
  if (similarity > 0.7) {
    recommendation = "These products appear very similar. Compare prices and ratings to choose.";
  } else if (similarity > 0.4) {
    recommendation = "These products have some similarities but notable differences. Review carefully.";
  } else {
    recommendation = "These products appear quite different. May not be good substitutes.";
  }

  return { similarity, matchedFeatures, differences, recommendation };
}
