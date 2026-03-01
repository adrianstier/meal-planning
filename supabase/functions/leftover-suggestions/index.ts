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

interface LeftoverIdea {
  name: string;
  description: string;
  transformationType: string;
  additionalIngredients: string[];
  instructions: string;
  estimatedTime: string;
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

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey, { maxTokens: 2000 });
    const suggestions = extractJSON<LeftoverIdea[]>(aiResponse);

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
