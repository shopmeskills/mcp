/**
 * Shopme API client — calls /mcp/goods endpoints.
 * No API keys required. Set SHOPME_API_BASE to override the default production URL.
 */

const DEFAULT_BASE = "https://api.shopmeagent.com";
const CALLER_ID = "cn-ecommerce-search-mcp";
const TIMEOUT_MS = 60_000;

function getBase(): string {
  return (process.env.SHOPME_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mcp-caller": CALLER_ID,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 422) {
    const detail = await res.json().catch(() => null);
    const msg = detail?.detail?.[0]?.msg ?? JSON.stringify(detail);
    throw new Error(`Validation error: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`Shopme API HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Search ──────────────────────────────────────────────────────

export type Platform = "xhs" | "taobao" | "tmall";

export type SortBy =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "sales_desc"
  | "created_at";

export interface SearchProductItem {
  product_id: string;
  platform: string;
  name: string;
  original_name: string;
  price: string;
  currency: string;
  image: string | null;
  url: string;
  shop_name: string;
  sales: string;
}

export interface SearchResponse {
  success: boolean;
  products: SearchProductItem[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  error: string | null;
}

export async function searchProducts(opts: {
  keyword: string;
  platform?: Platform;
  sort_by?: SortBy;
  page?: number;
  limit?: number;
}): Promise<SearchResponse> {
  const body: Record<string, unknown> = { keyword: opts.keyword };
  if (opts.platform) body.platform = opts.platform;
  if (opts.sort_by) body.sort_by = opts.sort_by;
  if (opts.page) body.page = opts.page;
  if (opts.limit) body.limit = opts.limit;
  return post<SearchResponse>("/mcp/goods/search", body);
}

// ── Detail ──────────────────────────────────────────────────────

export interface SkuItem {
  sku_id: string;
  name: string;
  price: string;
  image: string | null;
  stock: string | null;
}

export interface DetailResponse {
  success: boolean;
  product_id: string | null;
  platform: string | null;
  name: string;
  original_name: string;
  price: string;
  currency: string;
  description: string;
  images: string[];
  url: string;
  shop_name: string;
  shop_location: string;
  sales: string;
  stock_status: string;
  skus: SkuItem[];
  tags: string[];
  weight_grams: number | null;
  error: string | null;
}

export async function getProductDetail(opts: {
  product_id?: string;
  url?: string;
  platform?: Platform;
}): Promise<DetailResponse> {
  const body: Record<string, unknown> = {};
  if (opts.product_id) body.product_id = opts.product_id;
  if (opts.url) body.url = opts.url;
  if (opts.platform) body.platform = opts.platform;
  return post<DetailResponse>("/mcp/goods/detail", body);
}
