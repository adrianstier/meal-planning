import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_URL_LENGTH,
  isValidUrl,
  isPublicUrl,
  requireCsrfHeader,
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
  source_url: string;
  image_url: string | null;
}

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    // Handle redirects safely - validate redirect target against SSRF
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect with no location');
      const redirectUrl = new URL(location, url).href;
      if (!isPublicUrl(redirectUrl)) {
        throw new Error('Redirect to non-public URL blocked');
      }
      const redirectResponse = await fetch(redirectUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!redirectResponse.ok) {
        throw new Error(`HTTP ${redirectResponse.status} after redirect`);
      }
      return await redirectResponse.text();
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractImageUrl(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterMatch) return twitterMatch[1];

  return null;
}

function extractMainContent(html: string): string {
  // Remove scripts, styles, nav, etc.
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to find recipe containers
  const patterns = [
    /<article[^>]*class="[^"]*recipe[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*recipe-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*wprm-recipe[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }

  // Convert to text
  content = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

  // Limit to ~8000 chars for faster AI processing
  return content.substring(0, 8000);
}

// deno-lint-ignore no-explicit-any
function extractJsonLd(html: string): any | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "Recipe" || (Array.isArray(data["@type"]) && data["@type"].includes("Recipe"))) {
        return data;
      }
      if (data["@graph"]) {
        // deno-lint-ignore no-explicit-any
        const recipe = data["@graph"].find((item: any) =>
          item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
        );
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
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
      console.error(`[parse-recipe-url-ai] Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJSON(text: string): ParsedRecipe | null {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*\})/,
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

function validateRecipe(parsed: Partial<ParsedRecipe>, url: string, imageUrl: string | null): ParsedRecipe {
  return {
    name: parsed.name?.trim() || "Untitled Recipe",
    meal_type: ["breakfast", "lunch", "dinner", "snack"].includes(parsed.meal_type || "") ? parsed.meal_type! : "dinner",
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
    source_url: url,
    image_url: imageUrl || parsed.image_url || null,
  };
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
    const url = body.url;

    if (!url || !isValidUrl(url) || url.length > MAX_URL_LENGTH) {
      return errorResponse("Valid URL is required", corsHeaders, 400);
    }

    // SSRF protection - block private/internal URLs
    if (!isPublicUrl(url)) {
      return errorResponse("URL must point to a public website", corsHeaders, 400);
    }

    log({ requestId, event: "ai_parse_start", url: url.substring(0, 80) });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logError({ requestId, event: "missing_api_key", error: "ANTHROPIC_API_KEY not configured" });
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    // Fetch page
    let html: string;
    try {
      html = await fetchPage(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      return errorResponse(`Failed to fetch URL: ${msg}`, corsHeaders, 422);
    }

    const imageUrl = extractImageUrl(html);
    const jsonLd = extractJsonLd(html);
    const mainContent = extractMainContent(html);

    // Build context
    let context = "";
    if (jsonLd) {
      context = `STRUCTURED DATA:\n${JSON.stringify(jsonLd, null, 2)}\n\n`;
    }
    context += `PAGE CONTENT:\n${mainContent}`;

    const systemPrompt = `You are a recipe parser. Extract recipe data and return ONLY valid JSON, no other text.

Format ingredients as one per line with quantities.
Format instructions as numbered steps.
Estimate nutrition if not provided.
Kid-friendliness: 1-10 (10 = kid favorites like mac & cheese, 1 = spicy/complex)
Difficulty: easy (<30min total), medium (30-60min), hard (>60min)`;

    const userPrompt = `Parse this recipe into JSON:

${context}

Return this exact JSON structure (no markdown, no explanation):
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null}`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON(aiResponse);

    if (!parsed) {
      logError({ requestId, event: "ai_parse_failed", reason: "no_json", response: aiResponse.substring(0, 500) });
      return errorResponse("Failed to parse recipe. Please try again.", corsHeaders, 500);
    }

    const recipe = validateRecipe(parsed, url, imageUrl);
    log({ requestId, event: "ai_parse_success", name: recipe.name });

    return jsonResponse(recipe, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "ai_parse_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to parse recipe: ${message}`, corsHeaders, 500);
  }
});
