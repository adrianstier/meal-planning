import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_RECIPE_TEXT_LENGTH,
  sanitizeText,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  jsonResponse,
  errorResponse,
  log,
  logError,
} from "../_shared/cors.ts";

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

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

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

function extractJSON(text: string): ParsedRecipe | null {
  // Try to find JSON in the response
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*\})/,
  ];

  for (const pattern of jsonPatterns) {
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

function validateRecipe(parsed: Partial<ParsedRecipe>): ParsedRecipe {
  return {
    name: parsed.name?.trim() || "Untitled Recipe",
    meal_type: ["breakfast", "lunch", "dinner", "snack"].includes(parsed.meal_type || "")
      ? parsed.meal_type!
      : "dinner",
    ingredients: parsed.ingredients || "",
    instructions: parsed.instructions || "",
    prep_time_minutes: typeof parsed.prep_time_minutes === "number" ? parsed.prep_time_minutes : null,
    cook_time_minutes: typeof parsed.cook_time_minutes === "number" ? parsed.cook_time_minutes : null,
    servings: typeof parsed.servings === "number" && parsed.servings > 0 ? parsed.servings : 4,
    difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty || "") ? parsed.difficulty! : "medium",
    cuisine: parsed.cuisine || null,
    tags: parsed.tags || "",
    notes: parsed.notes || null,
    calories: typeof parsed.calories === "number" ? parsed.calories : null,
    protein_g: typeof parsed.protein_g === "number" ? parsed.protein_g : null,
    carbs_g: typeof parsed.carbs_g === "number" ? parsed.carbs_g : null,
    fat_g: typeof parsed.fat_g === "number" ? parsed.fat_g : null,
    fiber_g: typeof parsed.fiber_g === "number" ? parsed.fiber_g : null,
    kid_friendly_level: Math.min(10, Math.max(1, typeof parsed.kid_friendly_level === "number" ? parsed.kid_friendly_level : 5)),
    makes_leftovers: typeof parsed.makes_leftovers === "boolean" ? parsed.makes_leftovers : true,
    leftover_days: typeof parsed.leftover_days === "number" ? parsed.leftover_days : null,
    source_url: parsed.source_url || null,
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // CORS preflight
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

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
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null,"source_url":${sourceUrl ? `"${sourceUrl}"` : "null"}}`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON(aiResponse);

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
