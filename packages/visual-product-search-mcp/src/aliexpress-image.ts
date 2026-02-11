/**
 * AliExpress image search via DS API.
 * Requires ALIEXPRESS_DS_KEY, ALIEXPRESS_DS_SECRET.
 */

import crypto from "node:crypto";

const API_BASE = "https://api-sg.aliexpress.com/sync";

function getConfig() {
  const appKey = process.env.ALIEXPRESS_DS_KEY;
  const appSecret = process.env.ALIEXPRESS_DS_SECRET;

  if (!appKey || !appSecret) {
    throw new Error(
      "Missing AliExpress credentials. Set ALIEXPRESS_DS_KEY and ALIEXPRESS_DS_SECRET.",
    );
  }

  return { appKey, appSecret };
}

function signRequest(
  params: Record<string, string>,
  secret: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto
    .createHmac("sha256", secret)
    .update(sorted)
    .digest("hex")
    .toUpperCase();
}

async function callApi(
  method: string,
  params: Record<string, string>,
) {
  const config = getConfig();

  const baseParams: Record<string, string> = {
    app_key: config.appKey,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    sign_method: "sha256",
    method,
    v: "2.0",
    ...params,
  };

  baseParams.sign = signRequest(baseParams, config.appSecret);

  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(baseParams).toString(),
  });

  if (!response.ok) throw new Error(`AliExpress API HTTP ${response.status}`);
  return response.json();
}

export interface AliExpressImageSearchResult {
  items: Array<{
    productId: string;
    title: string;
    price: number;
    imageUrl: string;
    orders?: number;
    rating?: number;
  }>;
  totalResults: number;
}

/**
 * Search by image URL on AliExpress.
 */
export async function searchByImageAliExpress(
  imageUrl: string,
  options: {
    pageNo?: number;
    pageSize?: number;
    country?: string;
    currency?: string;
    language?: string;
  } = {},
): Promise<AliExpressImageSearchResult> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    target_currency: options.currency || "USD",
    target_language: options.language || "en",
    ship_to_country: options.country || "US",
    page_no: String(options.pageNo || 1),
    page_size: String(Math.min(options.pageSize || 20, 50)),
  };

  const data = (await callApi(
    "aliexpress.ds.image.search",
    params,
  )) as {
    result?: {
      products?: Array<{
        product_id: string;
        product_title: string;
        target_sale_price: string;
        product_main_image_url: string;
        orders_count?: number;
        evaluate_rate?: string;
      }>;
      total_record_count?: number;
    };
  };

  const products = data?.result?.products || [];

  return {
    items: products.map((p) => ({
      productId: p.product_id,
      title: p.product_title,
      price: parseFloat(p.target_sale_price),
      imageUrl: p.product_main_image_url,
      orders: p.orders_count,
      rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) : undefined,
    })),
    totalResults: data?.result?.total_record_count || products.length,
  };
}
