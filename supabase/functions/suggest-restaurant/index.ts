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
import { callClaude, extractJSON } from "../_shared/ai.ts";

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

  // Check Content-Length before parsing to prevent memory exhaustion
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  const MAX_BODY_SIZE = 100_000; // 100KB limit
  if (contentLength > MAX_BODY_SIZE) {
    return errorResponse('Request body too large', corsHeaders, 413);
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

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey, { maxTokens: 2000 });
    const suggestions = extractJSON<RestaurantSuggestion[]>(aiResponse);

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
