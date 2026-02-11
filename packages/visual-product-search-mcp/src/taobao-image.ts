/**
 * Taobao image search via IOP API.
 * Requires TAOBAO_APP_KEY, TAOBAO_APP_SECRET, TAOBAO_ACCESS_TOKEN.
 */

import crypto from "node:crypto";

const API_BASE = "https://api.taobao.global/rest";

function getConfig() {
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
) {
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

  const response = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(baseParams).toString(),
  });

  if (!response.ok) throw new Error(`Taobao API HTTP ${response.status}`);
  return response.json();
}

export interface ImageSearchResult {
  items: Array<{
    itemId: string;
    title: string;
    price: number;
    imageUrl: string;
    soldCount?: number;
    shopName?: string;
    similarity?: number;
  }>;
  totalResults: number;
}

/**
 * Search by image URL on Taobao.
 */
export async function searchByImageTaobao(
  imageUrl: string,
  options: { pageNo?: number; pageSize?: number } = {},
): Promise<ImageSearchResult> {
  const params: Record<string, string> = {
    pic_url: imageUrl,
    page_no: String(options.pageNo || 1),
    page_size: String(options.pageSize || 20),
  };

  const data = (await callApi("/traffic/item/imgsearch", "POST", params)) as {
    result?: {
      item_list?: Array<{
        item_id: string;
        title: string;
        price: string;
        pic_url: string;
        sold_count?: number;
        shop_name?: string;
      }>;
      total_results?: number;
    };
  };

  const items =
    data?.result?.item_list?.map((item) => ({
      itemId: item.item_id,
      title: item.title,
      price: parseFloat(item.price),
      imageUrl: item.pic_url.startsWith("//")
        ? `https:${item.pic_url}`
        : item.pic_url,
      soldCount: item.sold_count,
      shopName: item.shop_name,
    })) || [];

  return {
    items,
    totalResults: data?.result?.total_results || items.length,
  };
}

/**
 * Upload a base64 image to Taobao CDN for image search.
 */
export async function uploadImageToTaobao(
  imageBase64: string,
): Promise<{ picUrl: string | null; imageId?: string }> {
  const params: Record<string, string> = {
    image_base64: imageBase64,
  };

  const data = (await callApi("/upload/image", "POST", params)) as {
    result?: {
      pic_url?: string;
      image_id?: string;
    };
  };

  return {
    picUrl: data?.result?.pic_url || null,
    imageId: data?.result?.image_id,
  };
}
