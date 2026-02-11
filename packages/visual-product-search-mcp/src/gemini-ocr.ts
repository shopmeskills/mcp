/**
 * Gemini Vision API for product image analysis and OCR.
 * Requires GEMINI_API_KEY.
 */

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface ImageAnalysis {
  productName: string;
  category: string;
  description: string;
  suggestedSearchTerms: string[];
  detectedText: string[];
  estimatedPriceRange?: { min: number; max: number; currency: string };
  brand?: string;
  material?: string;
  color?: string;
}

/**
 * Analyze a product image using Gemini Vision to extract product info.
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  language: string = "en",
): Promise<ImageAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const prompt =
    language === "zh"
      ? `分析这张商品图片，提取以下信息并返回 JSON：
{
  "productName": "商品名称",
  "category": "商品类别",
  "description": "简短描述",
  "suggestedSearchTerms": ["搜索建议词1", "搜索建议词2", "搜索建议词3"],
  "detectedText": ["图片中检测到的文字"],
  "estimatedPriceRange": {"min": 最低估价, "max": 最高估价, "currency": "CNY"},
  "brand": "品牌(如有)",
  "material": "材质(如有)",
  "color": "颜色"
}
只返回 JSON，不要其他内容。`
      : `Analyze this product image and extract the following information as JSON:
{
  "productName": "product name",
  "category": "product category",
  "description": "brief description",
  "suggestedSearchTerms": ["search term 1", "search term 2", "search term 3"],
  "detectedText": ["any text detected in the image"],
  "estimatedPriceRange": {"min": low_estimate, "max": high_estimate, "currency": "USD"},
  "brand": "brand name if visible",
  "material": "material if identifiable",
  "color": "main color"
}
Return ONLY the JSON, no other text.`;

  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: undefined,
              fileData: undefined,
              // Use image URL directly
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  });

  // If direct URL doesn't work, fetch the image and send as base64
  if (!response.ok) {
    return analyzeImageWithBase64(imageUrl, apiKey, prompt);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return parseGeminiResponse(text);
}

async function analyzeImageWithBase64(
  imageUrl: string,
  apiKey: string,
  prompt: string,
): Promise<ImageAnalysis> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString("base64");
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

  const response = await fetch(
    `${GEMINI_API_BASE}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: contentType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return parseGeminiResponse(text);
}

function parseGeminiResponse(text: string): ImageAnalysis {
  // Extract JSON from the response (might have markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse Gemini response as JSON");

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ImageAnalysis>;
    return {
      productName: parsed.productName || "Unknown product",
      category: parsed.category || "Unknown",
      description: parsed.description || "",
      suggestedSearchTerms: parsed.suggestedSearchTerms || [],
      detectedText: parsed.detectedText || [],
      estimatedPriceRange: parsed.estimatedPriceRange,
      brand: parsed.brand,
      material: parsed.material,
      color: parsed.color,
    };
  } catch {
    throw new Error("Failed to parse Gemini response JSON");
  }
}
