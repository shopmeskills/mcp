/**
 * Taobao/Tmall API client using IOP (International Open Platform).
 * Requires TAOBAO_APP_KEY, TAOBAO_APP_SECRET, and TAOBAO_ACCESS_TOKEN.
 */

import crypto from "node:crypto";

const API_BASE = "https://api.taobao.global/rest";

interface TaobaoConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
}

function getConfig(): TaobaoConfig {
  const appKey = process.env.TAOBAO_APP_KEY;
  const appSecret = process.env.TAOBAO_APP_SECRET;
  const accessToken = process.env.TAOBAO_ACCESS_TOKEN;

  if (!appKey || !appSecret || !accessToken) {
    throw new Error(
      "Missing Taobao credentials. Set TAOBAO_APP_KEY, TAOBAO_APP_SECRET, TAOBAO_ACCESS_TOKEN.",
    );
  }

  return { appKey, appSecret, accessToken };
}

/**
 * Generate IOP signature for API requests.
 */
function signRequest(
  apiPath: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  const signStr = `${apiPath}${sorted}`;
  return crypto
    .createHmac("sha256", appSecret)
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

async function callApi(
  apiPath: string,
  method: "GET" | "POST",
  params: Record<string, string>,
): Promise<unknown> {
  const config = getConfig();

  const baseParams: Record<string, string> = {
    app_key: config.appKey,
    access_token: config.accessToken,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    sign_method: "sha256",
    format: "json",
    v: "2.0",
    ...params,
  };

  const sign = signRequest(apiPath, baseParams, config.appSecret);
  baseParams.sign = sign;

  const url = new URL(API_BASE);
  url.pathname += apiPath;

  if (method === "GET") {
    for (const [k, v] of Object.entries(baseParams)) {
      url.searchParams.set(k, v);
    }
    const response = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Taobao API HTTP ${response.status}`);
    return response.json();
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(baseParams).toString(),
  });
  if (!response.ok) throw new Error(`Taobao API HTTP ${response.status}`);
  return response.json();
}

export interface ProductSearchResult {
  items: ProductItem[];
  totalResults: number;
  pageNo: number;
  pageSize: number;
}

export interface ProductItem {
  itemId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  soldCount?: number;
  shopName?: string;
  platform: string;
}

export interface ProductDetail {
  productId: string;
  name: string;
  description: string;
  price: { current: number; original?: number };
  images: string[];
  variants: { name: string; options: string[] }[];
  stock: { status: string; quantity?: number };
  shopInfo: { shopId: string; shopName: string };
  category?: string;
  brand?: string;
}

/**
 * Search products by keyword on Taobao/Tmall.
 */
export async function searchProducts(
  keyword: string,
  options: {
    pageNo?: number;
    pageSize?: number;
    sort?: "PRICE_ASC" | "PRICE_DESC" | "SALE_QTY_DESC";
    language?: string;
  } = {},
): Promise<ProductSearchResult> {
  const params: Record<string, string> = {
    keyword,
    page_no: String(options.pageNo || 1),
    page_size: String(options.pageSize || 20),
  };

  if (options.sort) params.sort = options.sort;
  if (options.language) params.language = options.language;

  const data = (await callApi("/traffic/item/search", "GET", params)) as {
    result?: {
      item_list?: Array<{
        item_id: string;
        title: string;
        price: string;
        original_price?: string;
        pic_url: string;
        sold_count?: number;
        shop_name?: string;
      }>;
      total_results?: number;
      page_no?: number;
      page_size?: number;
    };
  };

  const result = data?.result;
  const items: ProductItem[] =
    result?.item_list?.map((item) => ({
      itemId: item.item_id,
      title: item.title,
      price: parseFloat(item.price),
      originalPrice: item.original_price
        ? parseFloat(item.original_price)
        : undefined,
      imageUrl: item.pic_url.startsWith("//")
        ? `https:${item.pic_url}`
        : item.pic_url,
      soldCount: item.sold_count,
      shopName: item.shop_name,
      platform: "taobao",
    })) || [];

  return {
    items,
    totalResults: result?.total_results || 0,
    pageNo: result?.page_no || 1,
    pageSize: result?.page_size || 20,
  };
}

/**
 * Get product detail by ID.
 */
export async function getProductDetail(
  productId: string,
  language: string = "en",
): Promise<ProductDetail> {
  const params: Record<string, string> = {
    item_id: productId,
    item_resource: "taobao",
    language,
  };

  const data = (await callApi("/traffic/item/get", "GET", params)) as {
    result?: {
      item_id?: string;
      title?: string;
      desc_short?: string;
      price?: string;
      org_price?: string;
      pic_url?: string;
      item_imgs?: Array<{ url: string }>;
      detail_imgs?: Array<{ url: string }>;
      sku_props?: Array<{ name: string; values: string[] }>;
      quantity?: number;
      shop_id?: string;
      shop_name?: string;
      cate_name?: string;
      brand?: string;
    };
  };

  const r = data?.result;
  if (!r) throw new Error("Product not found");

  const images: string[] = [];
  if (r.pic_url) images.push(r.pic_url);
  if (r.item_imgs) {
    images.push(...r.item_imgs.map((i) => i.url));
  }

  return {
    productId: r.item_id || productId,
    name: r.title || "",
    description: r.desc_short || "",
    price: {
      current: parseFloat(r.price || "0"),
      original: r.org_price ? parseFloat(r.org_price) : undefined,
    },
    images,
    variants:
      r.sku_props?.map((prop) => ({
        name: prop.name,
        options: prop.values,
      })) || [],
    stock: {
      status: (r.quantity ?? 0) > 0 ? "in_stock" : "out_of_stock",
      quantity: r.quantity,
    },
    shopInfo: {
      shopId: r.shop_id || "",
      shopName: r.shop_name || "",
    },
    category: r.cate_name,
    brand: r.brand,
  };
}
