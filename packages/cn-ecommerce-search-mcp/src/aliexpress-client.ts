/**
 * AliExpress DropShippers API client.
 * Requires ALIEXPRESS_DS_KEY and ALIEXPRESS_DS_SECRET.
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
): Promise<unknown> {
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

  if (!response.ok) {
    throw new Error(`AliExpress API HTTP ${response.status}`);
  }

  return response.json();
}

export interface AliExpressProduct {
  productId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  orders?: number;
  rating?: number;
  shippingInfo?: string;
}

/**
 * Search products on AliExpress by keyword.
 */
export async function searchAliExpress(
  keyword: string,
  options: {
    pageNo?: number;
    pageSize?: number;
    sort?: string;
    currency?: string;
    country?: string;
    language?: string;
  } = {},
): Promise<{ items: AliExpressProduct[]; totalResults: number }> {
  const params: Record<string, string> = {
    keywords: keyword,
    page_no: String(options.pageNo || 1),
    page_size: String(Math.min(options.pageSize || 20, 50)),
    target_currency: options.currency || "USD",
    target_language: options.language || "en",
    ship_to_country: options.country || "US",
  };

  if (options.sort) params.sort = options.sort;

  const data = (await callApi(
    "aliexpress.ds.product.search",
    params,
  )) as {
    result?: {
      products?: Array<{
        product_id: string;
        product_title: string;
        target_sale_price: string;
        target_original_price?: string;
        product_main_image_url: string;
        orders_count?: number;
        evaluate_rate?: string;
        logistics_info_dto?: { logistics_company?: string };
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
      originalPrice: p.target_original_price
        ? parseFloat(p.target_original_price)
        : undefined,
      imageUrl: p.product_main_image_url,
      orders: p.orders_count,
      rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) : undefined,
      shippingInfo: p.logistics_info_dto?.logistics_company,
    })),
    totalResults: data?.result?.total_record_count || 0,
  };
}

/**
 * Get product detail from AliExpress.
 */
export async function getAliExpressDetail(
  productId: string,
  options: {
    country?: string;
    currency?: string;
    language?: string;
  } = {},
): Promise<AliExpressProduct & { images: string[]; description: string }> {
  const params: Record<string, string> = {
    product_id: productId,
    target_currency: options.currency || "USD",
    target_language: options.language || "en",
    ship_to_country: options.country || "US",
  };

  const data = (await callApi(
    "aliexpress.ds.product.get",
    params,
  )) as {
    result?: {
      product_id?: string;
      product_title?: string;
      target_sale_price?: string;
      target_original_price?: string;
      product_main_image_url?: string;
      product_image_list?: string[];
      product_description?: string;
      orders_count?: number;
      evaluate_rate?: string;
    };
  };

  const r = data?.result;
  if (!r) throw new Error("AliExpress product not found");

  return {
    productId: r.product_id || productId,
    title: r.product_title || "",
    price: parseFloat(r.target_sale_price || "0"),
    originalPrice: r.target_original_price
      ? parseFloat(r.target_original_price)
      : undefined,
    imageUrl: r.product_main_image_url || "",
    images: r.product_image_list || [],
    description: r.product_description || "",
    orders: r.orders_count,
    rating: r.evaluate_rate ? parseFloat(r.evaluate_rate) : undefined,
  };
}
