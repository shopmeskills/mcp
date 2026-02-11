/**
 * AI-powered product recommendation using Gemini.
 */

const GEMINI_API =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface RecommendationRequest {
  productName: string;
  category?: string;
  budget?: { min: number; max: number; currency: string };
  preferences?: string[];
  purpose?: string;
}

export interface Recommendation {
  suggestions: Array<{
    name: string;
    reason: string;
    estimatedPrice: string;
    searchKeyword: string;
    platforms: string[];
  }>;
  buyingAdvice: string;
  keyFeaturesToLookFor: string[];
}

/**
 * Get AI-powered alternative product recommendations.
 */
export async function getRecommendations(
  request: RecommendationRequest,
): Promise<Recommendation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const budgetStr = request.budget
    ? `Budget: ${request.budget.min}-${request.budget.max} ${request.budget.currency}`
    : "No specific budget";

  const prefsStr = request.preferences?.length
    ? `Preferences: ${request.preferences.join(", ")}`
    : "";

  const prompt = `You are a cross-border e-commerce product expert. A user is looking for alternatives to "${request.productName}".

Category: ${request.category || "General"}
${budgetStr}
${prefsStr}
Purpose: ${request.purpose || "Personal use"}

Suggest 3-5 alternative products they could search for on Chinese e-commerce platforms (Taobao, 1688, AliExpress). Return ONLY valid JSON:

{
  "suggestions": [
    {
      "name": "product name",
      "reason": "why this is a good alternative",
      "estimatedPrice": "price range in CNY",
      "searchKeyword": "Chinese keyword for Taobao search",
      "platforms": ["recommended platforms"]
    }
  ],
  "buyingAdvice": "general advice for buying this type of product from China",
  "keyFeaturesToLookFor": ["important features to check"]
}`;

  const response = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

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

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse Gemini response");

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<Recommendation>;
    return {
      suggestions: parsed.suggestions || [],
      buyingAdvice: parsed.buyingAdvice || "",
      keyFeaturesToLookFor: parsed.keyFeaturesToLookFor || [],
    };
  } catch {
    throw new Error("Failed to parse recommendation JSON");
  }
}
