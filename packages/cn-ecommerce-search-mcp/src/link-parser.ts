/**
 * Parse product links from Chinese e-commerce platforms.
 */

export type Platform = "taobao" | "tmall" | "1688" | "aliexpress" | "xhs" | "unknown";

export interface LinkInfo {
  platform: Platform;
  productId: string | null;
  originalUrl: string;
  isValid: boolean;
  error?: string;
}

const PLATFORM_PATTERNS: {
  platform: Platform;
  patterns: RegExp[];
  idExtractors: ((url: string) => string | null)[];
}[] = [
  {
    platform: "taobao",
    patterns: [
      /item\.taobao\.com/i,
      /detail\.tmall\.com/i,
      /world\.taobao\.com/i,
      /h5\.m\.taobao\.com/i,
    ],
    idExtractors: [
      (url) => new URL(url).searchParams.get("id"),
      (url) => {
        const match = url.match(/[?&]id=(\d+)/);
        return match?.[1] ?? null;
      },
    ],
  },
  {
    platform: "tmall",
    patterns: [/detail\.tmall\.com/i, /detail\.tmall\.hk/i],
    idExtractors: [
      (url) => new URL(url).searchParams.get("id"),
      (url) => {
        const match = url.match(/[?&]id=(\d+)/);
        return match?.[1] ?? null;
      },
    ],
  },
  {
    platform: "1688",
    patterns: [/detail\.1688\.com/i, /m\.1688\.com/i],
    idExtractors: [
      (url) => {
        const match = url.match(/offer\/(\d+)\.html/i);
        return match?.[1] ?? null;
      },
    ],
  },
  {
    platform: "aliexpress",
    patterns: [
      /aliexpress\.com\/item/i,
      /aliexpress\.com\/i\//i,
      /aliexpress\.\w+\/item/i,
    ],
    idExtractors: [
      (url) => {
        const match = url.match(/\/(?:item\/|i\/)(\d+)(?:\.html)?/i);
        return match?.[1] ?? null;
      },
    ],
  },
  {
    platform: "xhs",
    patterns: [
      /mall\.xiaohongshu\.com/i,
      /xiaohongshu\.com\/goods-detail/i,
    ],
    idExtractors: [
      (url) => {
        const match = url.match(/goods-detail\/([a-f0-9]{24})/i);
        return match?.[1] ?? null;
      },
      (url) => {
        const match = url.match(/item_id=([a-f0-9]{24})/i);
        return match?.[1] ?? null;
      },
    ],
  },
];

/**
 * Parse a product URL and extract platform + product ID.
 */
export function parseProductLink(url: string): LinkInfo {
  const trimmed = url.trim();

  // Try to extract a URL from text
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i);
  const actualUrl = urlMatch ? urlMatch[0] : trimmed;

  for (const { platform, patterns, idExtractors } of PLATFORM_PATTERNS) {
    const matchesPlatform = patterns.some((p) => p.test(actualUrl));
    if (!matchesPlatform) continue;

    for (const extractor of idExtractors) {
      try {
        const productId = extractor(actualUrl);
        if (productId) {
          return {
            platform,
            productId,
            originalUrl: actualUrl,
            isValid: true,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      platform,
      productId: null,
      originalUrl: actualUrl,
      isValid: false,
      error: `Found ${platform} URL but could not extract product ID`,
    };
  }

  // Check for short links
  if (/e\.tb\.cn|m\.tb\.cn/i.test(actualUrl)) {
    return {
      platform: "taobao",
      productId: null,
      originalUrl: actualUrl,
      isValid: false,
      error: "Taobao short link detected. Resolve the redirect first to get the product ID.",
    };
  }

  return {
    platform: "unknown",
    productId: null,
    originalUrl: actualUrl,
    isValid: false,
    error: "Could not identify the e-commerce platform from this URL",
  };
}
