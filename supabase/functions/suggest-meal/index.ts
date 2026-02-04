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

interface MealSuggestion {
  name: string;
  description: string;
  reason: string;
  estimated_time: string;
  difficulty: string;
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function extractJSON(text: string): MealSuggestion[] | null {
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

  // Check Content-Length before parsing to prevent memory exhaustion
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  const MAX_BODY_SIZE = 100000; // 100KB limit
  if (contentLength > MAX_BODY_SIZE) {
    return new Response(
      JSON.stringify({ error: 'Request body too large' }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const {
      mealType = "dinner",
      cuisinePreferences = [],
      dietaryRestrictions = [],
      availableIngredients = [],
      cookingTime = "any",
      difficulty = "any",
      previousMeals = [],
    } = body;

    log({ requestId, event: "suggest_meal_start", mealType });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are a helpful meal planning assistant. Suggest creative, practical meal ideas based on user preferences. Always return valid JSON array.`;

    let userPrompt = `Suggest 5 ${mealType} ideas`;

    if (cuisinePreferences.length > 0) {
      userPrompt += ` with ${cuisinePreferences.join(" or ")} cuisine`;
    }

    if (dietaryRestrictions.length > 0) {
      userPrompt += `. Dietary restrictions: ${dietaryRestrictions.join(", ")}`;
    }

    if (availableIngredients.length > 0) {
      userPrompt += `. Preferably using: ${availableIngredients.join(", ")}`;
    }

    if (cookingTime !== "any") {
      userPrompt += `. Cooking time: ${cookingTime}`;
    }

    if (difficulty !== "any") {
      userPrompt += `. Difficulty level: ${difficulty}`;
    }

    if (previousMeals.length > 0) {
      userPrompt += `. Avoid repeating these recent meals: ${previousMeals.slice(0, 5).join(", ")}`;
    }

    userPrompt += `

Return a JSON array with exactly 5 suggestions in this format:
[{"name":"Meal Name","description":"Brief description","reason":"Why this is a good choice","estimated_time":"30 minutes","difficulty":"easy|medium|hard"}]`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const suggestions = extractJSON(aiResponse);

    if (!suggestions || suggestions.length === 0) {
      logError({ requestId, event: "suggest_meal_failed", reason: "no_suggestions" });
      return errorResponse("Failed to generate suggestions. Please try again.", corsHeaders, 500);
    }

    log({ requestId, event: "suggest_meal_success", count: suggestions.length });

    return jsonResponse({ suggestions }, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "suggest_meal_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to suggest meals: ${message}`, corsHeaders, 500);
  }
});
