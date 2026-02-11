/**
 * Xiaohongshu (RED) API client.
 * Uses the web API with user-provided cookies for authentication.
 * Requires XHS_COOKIE environment variable.
 */

const XHS_API_BASE = "https://edith.xiaohongshu.com/api/sns";
const XHS_MALL_API = "https://mall.xiaohongshu.com/api/store";

interface XhsConfig {
  cookie: string;
}

function getConfig(): XhsConfig {
  const cookie = process.env.XHS_COOKIE;
  if (!cookie) {
    throw new Error(
      "Missing XHS_COOKIE environment variable. Log into xiaohongshu.com in your browser and copy the cookie value.",
    );
  }
  return { cookie };
}

function getHeaders(cookie: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Cookie: cookie,
    Origin: "https://www.xiaohongshu.com",
    Referer: "https://www.xiaohongshu.com/",
    "Content-Type": "application/json",
  };
}

// --- Types ---

export interface XhsNote {
  noteId: string;
  title: string;
  description: string;
  type: "normal" | "video";
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  imageUrls: string[];
  videoUrl?: string;
  author: {
    userId: string;
    nickname: string;
    avatar?: string;
  };
  tags: string[];
  publishTime: string;
}

export interface XhsProduct {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  sales?: number;
  shopName?: string;
  rating?: number;
}

export interface XhsCreator {
  userId: string;
  nickname: string;
  avatar: string;
  description: string;
  followers: number;
  following: number;
  notes: number;
  likes: number;
  isVerified: boolean;
  tags: string[];
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

// --- API Functions ---

/**
 * Search notes by keyword.
 */
export async function searchNotes(
  keyword: string,
  options: {
    page?: number;
    pageSize?: number;
    sort?: "general" | "popularity" | "latest";
    noteType?: "all" | "normal" | "video";
  } = {},
): Promise<SearchResult<XhsNote>> {
  const config = getConfig();

  const sortMap = {
    general: 0,
    popularity: 1,
    latest: 2,
  };

  const noteTypeMap = {
    all: 0,
    normal: 1,
    video: 2,
  };

  const body = {
    keyword,
    page: options.page || 1,
    page_size: options.pageSize || 20,
    sort: sortMap[options.sort || "general"],
    note_type: noteTypeMap[options.noteType || "all"],
    search_id: generateSearchId(),
  };

  const response = await fetch(`${XHS_API_BASE}/v1/search/notes`, {
    method: "POST",
    headers: getHeaders(config.cookie),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`XHS search failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: {
      items?: Array<{
        id: string;
        note_card?: {
          display_title?: string;
          desc?: string;
          type?: string;
          interact_info?: {
            liked_count?: string;
            collected_count?: string;
            comment_count?: string;
            share_count?: string;
          };
          image_list?: Array<{ url_default?: string }>;
          video?: { url?: string };
          user?: {
            user_id?: string;
            nickname?: string;
            avatar?: string;
          };
          tag_list?: Array<{ name?: string }>;
          time?: number;
        };
      }>;
      has_more?: boolean;
    };
  };

  if (!data.success) {
    throw new Error("XHS search returned unsuccessful response");
  }

  const items: XhsNote[] =
    data.data?.items?.map((item) => {
      const card = item.note_card;
      return {
        noteId: item.id,
        title: card?.display_title || "",
        description: card?.desc || "",
        type: card?.type === "video" ? "video" : "normal",
        likes: parseInt(card?.interact_info?.liked_count || "0"),
        collects: parseInt(card?.interact_info?.collected_count || "0"),
        comments: parseInt(card?.interact_info?.comment_count || "0"),
        shares: parseInt(card?.interact_info?.share_count || "0"),
        imageUrls:
          card?.image_list?.map((img) => img.url_default || "").filter(Boolean) || [],
        videoUrl: card?.video?.url,
        author: {
          userId: card?.user?.user_id || "",
          nickname: card?.user?.nickname || "",
          avatar: card?.user?.avatar,
        },
        tags: card?.tag_list?.map((t) => t.name || "").filter(Boolean) || [],
        publishTime: card?.time ? new Date(card.time).toISOString() : "",
      };
    }) || [];

  return {
    items,
    total: items.length,
    hasMore: data.data?.has_more || false,
  };
}

/**
 * Get note detail by ID.
 */
export async function getNoteDetail(noteId: string): Promise<XhsNote> {
  const config = getConfig();

  const response = await fetch(`${XHS_API_BASE}/v1/note/${noteId}`, {
    method: "GET",
    headers: getHeaders(config.cookie),
  });

  if (!response.ok) {
    throw new Error(`XHS note detail failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: {
      note_list?: Array<{
        note_id?: string;
        title?: string;
        desc?: string;
        type?: string;
        interact_info?: {
          liked_count?: number;
          collected_count?: number;
          comment_count?: number;
          share_count?: number;
        };
        image_list?: Array<{ url?: string }>;
        video?: { url?: string };
        user?: {
          user_id?: string;
          nickname?: string;
          avatar?: string;
        };
        tag_list?: Array<{ name?: string }>;
        time?: number;
      }>;
    };
  };

  const note = data?.data?.note_list?.[0];
  if (!note) throw new Error("Note not found");

  return {
    noteId: note.note_id || noteId,
    title: note.title || "",
    description: note.desc || "",
    type: note.type === "video" ? "video" : "normal",
    likes: note.interact_info?.liked_count || 0,
    collects: note.interact_info?.collected_count || 0,
    comments: note.interact_info?.comment_count || 0,
    shares: note.interact_info?.share_count || 0,
    imageUrls: note.image_list?.map((img) => img.url || "").filter(Boolean) || [],
    videoUrl: note.video?.url,
    author: {
      userId: note.user?.user_id || "",
      nickname: note.user?.nickname || "",
      avatar: note.user?.avatar,
    },
    tags: note.tag_list?.map((t) => t.name || "").filter(Boolean) || [],
    publishTime: note.time ? new Date(note.time).toISOString() : "",
  };
}

/**
 * Search products on Xiaohongshu Mall.
 */
export async function searchProducts(
  keyword: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<SearchResult<XhsProduct>> {
  const config = getConfig();

  const params = new URLSearchParams({
    keyword,
    page: String(options.page || 1),
    page_size: String(options.pageSize || 20),
  });

  const response = await fetch(
    `${XHS_MALL_API}/jpd/search/items?${params.toString()}`,
    {
      method: "GET",
      headers: getHeaders(config.cookie),
    },
  );

  if (!response.ok) {
    throw new Error(`XHS product search failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: {
      items?: Array<{
        item_id?: string;
        name?: string;
        price?: number;
        original_price?: number;
        image?: string;
        sales_count?: number;
        shop_name?: string;
        rating?: number;
      }>;
      total?: number;
      has_more?: boolean;
    };
  };

  const items: XhsProduct[] =
    data.data?.items?.map((item) => ({
      productId: item.item_id || "",
      name: item.name || "",
      price: item.price || 0,
      originalPrice: item.original_price,
      imageUrl: item.image || "",
      sales: item.sales_count,
      shopName: item.shop_name,
      rating: item.rating,
    })) || [];

  return {
    items,
    total: data.data?.total || items.length,
    hasMore: data.data?.has_more || false,
  };
}

/**
 * Get creator (user) profile info.
 */
export async function getCreatorInfo(userId: string): Promise<XhsCreator> {
  const config = getConfig();

  const response = await fetch(`${XHS_API_BASE}/v1/user/${userId}`, {
    method: "GET",
    headers: getHeaders(config.cookie),
  });

  if (!response.ok) {
    throw new Error(`XHS user info failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: {
      user_id?: string;
      nickname?: string;
      images?: string;
      desc?: string;
      fans?: number;
      follows?: number;
      notes?: number;
      liked?: number;
      red_official_verified?: boolean;
      tags?: Array<{ name?: string }>;
    };
  };

  const user = data?.data;
  if (!user) throw new Error("Creator not found");

  return {
    userId: user.user_id || userId,
    nickname: user.nickname || "",
    avatar: user.images || "",
    description: user.desc || "",
    followers: user.fans || 0,
    following: user.follows || 0,
    notes: user.notes || 0,
    likes: user.liked || 0,
    isVerified: user.red_official_verified || false,
    tags: user.tags?.map((t) => t.name || "").filter(Boolean) || [],
  };
}

// Helper
function generateSearchId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
