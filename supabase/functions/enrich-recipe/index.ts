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

interface EnrichableFields {
  cuisine: string | null;
  tags: string | null;
  difficulty: string | null;
  cook_time_minutes: number | null;
  prep_time_minutes: number | null;
  servings: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  kid_friendly_level: number | null;
  makes_leftovers: boolean | null;
  leftover_days: number | null;
}

function sanitizeStr(s: string | undefined | null): string {
  if (!s) return "";
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function validateEnrichment(parsed: Partial<EnrichableFields>): Partial<EnrichableFields> {
  const result: Partial<EnrichableFields> = {};

  if (parsed.cuisine != null) {
    const val = sanitizeStr(String(parsed.cuisine)).trim();
    if (val) result.cuisine = val;
  }
  if (parsed.tags != null) {
    const val = sanitizeStr(String(parsed.tags)).trim();
    if (val) result.tags = val;
  }
  if (parsed.difficulty != null) {
    if (["easy", "medium", "hard"].includes(String(parsed.difficulty))) {
      result.difficulty = String(parsed.difficulty);
    }
  }
  if (Number.isFinite(parsed.cook_time_minutes)) {
    result.cook_time_minutes = Math.min(1440, Math.max(1, Math.round(parsed.cook_time_minutes!)));
  }
  if (Number.isFinite(parsed.prep_time_minutes)) {
    result.prep_time_minutes = Math.min(1440, Math.max(1, Math.round(parsed.prep_time_minutes!)));
  }
  if (Number.isFinite(parsed.servings) && parsed.servings! > 0) {
    result.servings = Math.min(100, Math.round(parsed.servings!));
  }
  if (Number.isFinite(parsed.calories) && parsed.calories! > 0) {
    result.calories = Math.round(parsed.calories!);
  }
  if (Number.isFinite(parsed.protein_g) && parsed.protein_g! >= 0) {
    result.protein_g = Math.round(parsed.protein_g!);
  }
  if (Number.isFinite(parsed.carbs_g) && parsed.carbs_g! >= 0) {
    result.carbs_g = Math.round(parsed.carbs_g!);
  }
  if (Number.isFinite(parsed.fat_g) && parsed.fat_g! >= 0) {
    result.fat_g = Math.round(parsed.fat_g!);
  }
  if (Number.isFinite(parsed.fiber_g) && parsed.fiber_g! >= 0) {
    result.fiber_g = Math.round(parsed.fiber_g!);
  }
  if (Number.isFinite(parsed.kid_friendly_level)) {
    result.kid_friendly_level = Math.min(10, Math.max(1, Math.round(parsed.kid_friendly_level!)));
  }
  if (typeof parsed.makes_leftovers === "boolean") {
    result.makes_leftovers = parsed.makes_leftovers;
  }
  if (Number.isFinite(parsed.leftover_days) && parsed.leftover_days! > 0) {
    result.leftover_days = Math.min(14, Math.round(parsed.leftover_days!));
  }

  return result;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", corsHeaders, 405);
  }

  if (!requireCsrfHeader(req)) {
    return new Response(
      JSON.stringify({ error: "Missing security header" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const auth = await validateJWT(req);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", corsHeaders, 401);
  }

  const rateLimit = checkRateLimitSync(auth.userId!);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(corsHeaders, rateLimit.resetIn);
  }

  try {
    const bodyText = await req.text();
    if (bodyText.length > 100000) {
      return errorResponse("Request body too large", corsHeaders, 413);
    }
    if (!bodyText) {
      return errorResponse("Request body is empty", corsHeaders, 400);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return errorResponse("Invalid JSON in request body", corsHeaders, 400);
    }

    const recipe = body.recipe as Record<string, unknown> | undefined;
    if (!recipe || typeof recipe !== "object") {
      return errorResponse("Missing recipe object", corsHeaders, 400);
    }

    const recipeName = recipe.name;
    if (!recipeName || typeof recipeName !== "string" || !recipeName.trim()) {
      return errorResponse("Recipe must have a name", corsHeaders, 400);
    }

    // Identify which fields are missing
    const enrichableFieldNames: (keyof EnrichableFields)[] = [
      "cuisine", "tags", "difficulty", "cook_time_minutes", "prep_time_minutes",
      "servings", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g",
      "kid_friendly_level", "makes_leftovers", "leftover_days",
    ];

    const missingFields: string[] = [];
    for (const field of enrichableFieldNames) {
      const val = recipe[field];
      if (val === null || val === undefined || val === "") {
        missingFields.push(field);
      }
    }

    if (missingFields.length === 0) {
      return jsonResponse({}, corsHeaders);
    }

    log({ requestId, event: "enrich_start", name: recipeName, missingFields: missingFields.length });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logError({ requestId, event: "missing_api_key" });
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    // Build context from known data
    const knownData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(recipe)) {
      if (val !== null && val !== undefined && val !== "") {
        knownData[key] = val;
      }
    }

    const systemPrompt = `You are a recipe knowledge expert. Given a recipe name and any known data, estimate the missing fields.

Rules:
- Only provide values for the requested missing fields
- For nutrition: estimate per serving based on typical preparation
- Kid-friendliness: 1-10 (10 = universally loved like mac & cheese, 1 = very spicy/complex flavors)
- Difficulty: "easy" (<30min total), "medium" (30-60min), "hard" (>60min)
- Tags: comma-separated, relevant categories (e.g., "italian, pasta, comfort-food, weeknight")
- makes_leftovers: true if recipe typically makes enough for next-day leftovers
- leftover_days: how many days leftovers stay good (1-7 typically)
- Return ONLY valid JSON with the missing fields filled in, no other text`;

    const userPrompt = `Recipe: "${recipeName}"
Known data: ${JSON.stringify(knownData)}

Fill in ONLY these missing fields: ${missingFields.join(", ")}

Return JSON with just these fields:
{${missingFields.map(f => `"${f}": ...`).join(", ")}}`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey, { maxTokens: 1000 });
    const parsed = extractJSON<Partial<EnrichableFields>>(aiResponse);

    if (!parsed) {
      logError({ requestId, event: "enrich_parse_failed", response: aiResponse.substring(0, 500) });
      return errorResponse("Failed to enrich recipe. Please try again.", corsHeaders, 500);
    }

    const enriched = validateEnrichment(parsed);
    log({ requestId, event: "enrich_success", name: recipeName, fieldsEnriched: Object.keys(enriched).length });

    return jsonResponse(enriched, corsHeaders);
  } catch (error) {
    logError({ requestId, event: "enrich_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to enrich recipe: ${message}`, corsHeaders, 500);
  }
});
