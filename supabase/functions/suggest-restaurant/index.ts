import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  requireCsrfHeader,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  jsonResponse,
  errorResponse,
  log,
  logError,
} from "../_shared/cors.ts";

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

interface RestaurantSuggestion {
  name: string;
  cuisine: string;
  description: string;
  priceRange: string;
  kidFriendly: boolean;
  dietaryOptions: string[];
  whyRecommended: string;
  typicalDishes: string[];
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJSON(text: string): RestaurantSuggestion[] | null {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\[[\s\S]*\])/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        continue;
      }
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // CORS preflight
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

  // CSRF protection
  if (!requireCsrfHeader(req)) {
    return new Response(
      JSON.stringify({ error: 'Missing security header' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Auth
  const auth = await validateJWT(req);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", corsHeaders, 401);
  }

  // Rate limit
  const rateLimit = checkRateLimitSync(auth.userId!);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(corsHeaders, rateLimit.resetIn);
  }

  try {
    const body = await req.json();
    const {
      occasion = "casual dinner",
      cuisinePreferences = [],
      dietaryRestrictions = [],
      priceRange = "moderate",
      partySize = 4,
      hasKids = false,
      location = "",
    } = body;

    log({ requestId, event: "suggest_restaurant_start", occasion });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are a helpful restaurant recommendation assistant. Suggest restaurant types and concepts based on user preferences. Since you don't have access to real-time restaurant data, focus on suggesting restaurant categories, cuisine types, and what to look for. Always return valid JSON array.`;

    let userPrompt = `I'm looking for restaurant suggestions for: ${occasion}
Party size: ${partySize} people
Price range: ${priceRange}`;

    if (cuisinePreferences.length > 0) {
      userPrompt += `\nCuisine preferences: ${cuisinePreferences.join(", ")}`;
    }

    if (dietaryRestrictions.length > 0) {
      userPrompt += `\nDietary needs: ${dietaryRestrictions.join(", ")}`;
    }

    if (hasKids) {
      userPrompt += `\nNeeds to be kid-friendly`;
    }

    if (location) {
      userPrompt += `\nLocation/area: ${location}`;
    }

    userPrompt += `

Suggest 5 restaurant types/concepts to look for. Return a JSON array:
[{
  "name": "Type of restaurant (e.g., 'Farm-to-Table American')",
  "cuisine": "Primary cuisine type",
  "description": "What to expect",
  "priceRange": "$|$$|$$$|$$$$",
  "kidFriendly": true/false,
  "dietaryOptions": ["Vegetarian options", "Gluten-free available"],
  "whyRecommended": "Why this matches your needs",
  "typicalDishes": ["Dish 1", "Dish 2", "Dish 3"]
}]

Focus on actionable suggestions they can search for locally.`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const suggestions = extractJSON(aiResponse);

    if (!suggestions || suggestions.length === 0) {
      logError({ requestId, event: "suggest_restaurant_failed", reason: "no_suggestions" });
      return errorResponse("Failed to generate suggestions. Please try again.", corsHeaders, 500);
    }

    log({ requestId, event: "suggest_restaurant_success", count: suggestions.length });

    return jsonResponse({ suggestions }, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "suggest_restaurant_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to suggest restaurants: ${message}`, corsHeaders, 500);
  }
});
