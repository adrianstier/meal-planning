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

interface LeftoverIdea {
  name: string;
  description: string;
  transformationType: string;
  additionalIngredients: string[];
  instructions: string;
  estimatedTime: string;
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  // 30-second timeout to prevent hanging requests
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
      console.error(`[leftover-suggestions] Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJSON(text: string): LeftoverIdea[] | null {
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
      originalMeal,
      leftoverIngredients = [],
      availableTime = "30 minutes",
      servingsNeeded = 2,
    } = body;

    if (!originalMeal && leftoverIngredients.length === 0) {
      return errorResponse("Please provide original meal name or leftover ingredients", corsHeaders, 400);
    }

    log({ requestId, event: "leftover_suggestions_start", originalMeal });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are a creative chef who specializes in transforming leftovers into delicious new meals. Suggest practical, easy ways to repurpose leftovers. Always return valid JSON array.`;

    let userPrompt = `I have leftovers`;

    if (originalMeal) {
      userPrompt += ` from ${originalMeal}`;
    }

    if (leftoverIngredients.length > 0) {
      userPrompt += `. Leftover ingredients: ${leftoverIngredients.join(", ")}`;
    }

    userPrompt += `. Available cooking time: ${availableTime}. Need to serve ${servingsNeeded} people.

Suggest 3 creative ways to transform these leftovers into new meals. Return a JSON array:
[{"name":"New Dish Name","description":"What it is","transformationType":"remix|upgrade|fusion","additionalIngredients":["item1","item2"],"instructions":"Brief instructions","estimatedTime":"15 minutes"}]

Transformation types:
- remix: Simple combination into new dish (e.g., fried rice from leftover rice)
- upgrade: Elevate with new ingredients (e.g., pasta bake from leftover pasta)
- fusion: Creative mashup (e.g., taco filling from leftover roast)`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const suggestions = extractJSON(aiResponse);

    if (!suggestions || suggestions.length === 0) {
      logError({ requestId, event: "leftover_suggestions_failed", reason: "no_suggestions" });
      return errorResponse("Failed to generate suggestions. Please try again.", corsHeaders, 500);
    }

    log({ requestId, event: "leftover_suggestions_success", count: suggestions.length });

    return jsonResponse({ suggestions }, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "leftover_suggestions_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to suggest leftover ideas: ${message}`, corsHeaders, 500);
  }
});
