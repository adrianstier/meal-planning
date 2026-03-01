import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_RECIPE_TEXT_LENGTH,
  sanitizeText,
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

interface ParsedRecipe {
  name: string;
  meal_type: string;
  ingredients: string;
  instructions: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  difficulty: string;
  cuisine: string | null;
  tags: string;
  notes: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  kid_friendly_level: number;
  makes_leftovers: boolean;
  leftover_days: number | null;
  source_url: string | null;
}

// Strip control characters that can break JSON parsing in clients
function sanitizeStr(s: string | undefined | null): string {
  if (!s) return "";
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function validateRecipe(parsed: Partial<ParsedRecipe>): ParsedRecipe {
  return {
    name: sanitizeStr(parsed.name?.trim()) || "Untitled Recipe",
    meal_type: ["breakfast", "lunch", "dinner", "snack"].includes(parsed.meal_type || "")
      ? parsed.meal_type!
      : "dinner",
    ingredients: sanitizeStr(parsed.ingredients),
    instructions: sanitizeStr(parsed.instructions),
    prep_time_minutes: Number.isFinite(parsed.prep_time_minutes) ? Math.min(1440, Math.max(0, parsed.prep_time_minutes!)) : null,
    cook_time_minutes: Number.isFinite(parsed.cook_time_minutes) ? Math.min(1440, Math.max(0, parsed.cook_time_minutes!)) : null,
    servings: Number.isFinite(parsed.servings) && parsed.servings! > 0 ? Math.round(Math.min(100, parsed.servings!)) : 4,
    difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty || "") ? parsed.difficulty! : "medium",
    cuisine: sanitizeStr(parsed.cuisine) || null,
    tags: sanitizeStr(parsed.tags),
    notes: sanitizeStr(parsed.notes) || null,
    calories: Number.isFinite(parsed.calories) ? Math.max(0, parsed.calories!) : null,
    protein_g: Number.isFinite(parsed.protein_g) ? Math.max(0, parsed.protein_g!) : null,
    carbs_g: Number.isFinite(parsed.carbs_g) ? Math.max(0, parsed.carbs_g!) : null,
    fat_g: Number.isFinite(parsed.fat_g) ? Math.max(0, parsed.fat_g!) : null,
    fiber_g: Number.isFinite(parsed.fiber_g) ? Math.max(0, parsed.fiber_g!) : null,
    kid_friendly_level: Math.min(10, Math.max(1, Number.isFinite(parsed.kid_friendly_level) ? parsed.kid_friendly_level! : 5)),
    makes_leftovers: typeof parsed.makes_leftovers === "boolean" ? parsed.makes_leftovers : true,
    leftover_days: Number.isFinite(parsed.leftover_days) ? parsed.leftover_days! : null,
    source_url: parsed.source_url || null,
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // CORS preflight
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

  // Method validation
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', corsHeaders, 405);
  }

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

  // Read body as text first to check actual size (Content-Length can be spoofed)
  const MAX_BODY_SIZE = 100000; // 100KB limit

  try {
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      return errorResponse('Request body too large', corsHeaders, 413);
    }
    if (!bodyText) {
      return errorResponse('Request body is empty', corsHeaders, 400);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return errorResponse('Invalid JSON in request body', corsHeaders, 400);
    }
    const recipeText = body.recipe_text;
    const sourceUrl = body.source_url || null;

    if (!recipeText || typeof recipeText !== "string") {
      return errorResponse("Recipe text is required", corsHeaders, 400);
    }

    if (recipeText.length > MAX_RECIPE_TEXT_LENGTH) {
      return errorResponse("Recipe text too long (max 100KB)", corsHeaders, 400);
    }

    const sanitizedText = sanitizeText(recipeText, MAX_RECIPE_TEXT_LENGTH);
    log({ requestId, event: "parse_start", textLength: sanitizedText.length });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logError({ requestId, event: "missing_api_key", error: "ANTHROPIC_API_KEY not configured" });
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are a recipe parser. Extract recipe data and return ONLY valid JSON, no other text.

Format ingredients as one per line with quantities.
Format instructions as numbered steps.
Estimate nutrition if not provided.
Kid-friendliness: 1-10 (10 = kid favorites like mac & cheese, 1 = spicy/complex)
Difficulty: easy (<30min total), medium (30-60min), hard (>60min)`;

    const userPrompt = `Parse this recipe into JSON:

${sanitizedText}

Return this exact JSON structure (no markdown, no explanation):
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null,"source_url":${sourceUrl ? JSON.stringify(sourceUrl) : "null"}}`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON<ParsedRecipe>(aiResponse);

    if (!parsed) {
      logError({ requestId, event: "parse_failed", reason: "no_json", response: aiResponse.substring(0, 500) });
      return errorResponse("Failed to parse recipe. Please try again.", corsHeaders, 500);
    }

    const recipe = validateRecipe(parsed);
    log({ requestId, event: "parse_success", name: recipe.name });

    return jsonResponse(recipe, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "parse_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to parse recipe: ${message}`, corsHeaders, 500);
  }
});
