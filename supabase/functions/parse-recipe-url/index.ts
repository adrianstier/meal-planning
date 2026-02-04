import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_URL_LENGTH,
  isValidUrl,
  isPublicUrl,
  requireCsrfHeader,
  validateJWT,
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
  source_url: string;
  image_url: string | null;
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

// deno-lint-ignore no-explicit-any
function findRecipeInJsonLd(html: string): any | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Check if it's directly a Recipe
      if (data["@type"] === "Recipe" || (Array.isArray(data["@type"]) && data["@type"].includes("Recipe"))) {
        return data;
      }

      // Check in @graph
      if (data["@graph"] && Array.isArray(data["@graph"])) {
        const recipe = data["@graph"].find(
          // deno-lint-ignore no-explicit-any
          (item: any) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
        );
        if (recipe) return recipe;
      }

      // Check if it's an array
      if (Array.isArray(data)) {
        const recipe = data.find(
          // deno-lint-ignore no-explicit-any
          (item: any) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
        );
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractImageUrl(html: string): string | null {
  // Try og:image first
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  // Try twitter:image
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterMatch) return twitterMatch[1];

  return null;
}

function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (match) {
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    return hours * 60 + minutes;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
function formatRecipe(jsonLd: any, url: string, imageUrl: string | null): ParsedRecipe {
  // Parse ingredients
  let ingredients = "";
  if (jsonLd.recipeIngredient) {
    ingredients = Array.isArray(jsonLd.recipeIngredient)
      ? jsonLd.recipeIngredient.join("\n")
      : String(jsonLd.recipeIngredient);
  }

  // Parse instructions
  let instructions = "";
  if (jsonLd.recipeInstructions) {
    if (Array.isArray(jsonLd.recipeInstructions)) {
      instructions = jsonLd.recipeInstructions
        // deno-lint-ignore no-explicit-any
        .map((step: any, i: number) => {
          if (typeof step === "string") return `${i + 1}. ${step}`;
          if (step.text) return `${i + 1}. ${step.text}`;
          if (step.itemListElement) {
            // deno-lint-ignore no-explicit-any
            return step.itemListElement.map((s: any, j: number) => `${i + 1}.${j + 1}. ${s.text || ""}`).join("\n");
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    } else {
      instructions = String(jsonLd.recipeInstructions);
    }
  }

  // Parse servings
  let servings = 4;
  if (jsonLd.recipeYield) {
    const yieldStr = Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield[0] : jsonLd.recipeYield;
    const match = String(yieldStr).match(/\d+/);
    if (match) servings = parseInt(match[0], 10);
  }

  // Parse tags
  const tags: string[] = [];
  if (jsonLd.recipeCategory) {
    const cats = Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory : [jsonLd.recipeCategory];
    tags.push(...cats);
  }
  if (jsonLd.keywords) {
    const kw = typeof jsonLd.keywords === "string" ? jsonLd.keywords.split(",").map((k: string) => k.trim()) : jsonLd.keywords;
    tags.push(...kw);
  }

  // Calculate difficulty
  const prepTime = parseDuration(jsonLd.prepTime);
  const cookTime = parseDuration(jsonLd.cookTime);
  const totalTime = (prepTime || 0) + (cookTime || 0);
  let difficulty = "medium";
  if (totalTime > 0 && totalTime <= 30) difficulty = "easy";
  else if (totalTime > 60) difficulty = "hard";

  // Determine meal type
  let mealType = "dinner";
  const category = Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.join(" ") : (jsonLd.recipeCategory || "");
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes("breakfast")) mealType = "breakfast";
  else if (categoryLower.includes("lunch")) mealType = "lunch";
  else if (categoryLower.includes("snack") || categoryLower.includes("appetizer")) mealType = "snack";

  // Get image from JSON-LD if not found in meta tags
  let finalImageUrl = imageUrl;
  if (!finalImageUrl && jsonLd.image) {
    if (typeof jsonLd.image === "string") finalImageUrl = jsonLd.image;
    else if (Array.isArray(jsonLd.image)) finalImageUrl = jsonLd.image[0];
    else if (jsonLd.image.url) finalImageUrl = jsonLd.image.url;
  }

  return {
    name: jsonLd.name || "Untitled Recipe",
    meal_type: mealType,
    ingredients,
    instructions,
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    servings,
    difficulty,
    cuisine: jsonLd.recipeCuisine || null,
    tags: tags.slice(0, 10).join(", "),
    notes: jsonLd.description || null,
    source_url: url,
    image_url: finalImageUrl,
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

    log({ requestId, event: "parse_url_start", url: url.substring(0, 80) });

    // Fetch the page
    let html: string;
    try {
      html = await fetchPage(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      return errorResponse(`Failed to fetch URL: ${msg}`, corsHeaders, 422);
    }

    // Extract JSON-LD
    const jsonLd = findRecipeInJsonLd(html);

    if (!jsonLd) {
      // No structured data - suggest AI parsing
      log({ requestId, event: "no_jsonld" });
      return errorResponse(
        "No structured recipe data found. Try AI Enhanced parsing.",
        corsHeaders,
        422,
        { needsAI: true, message: "This page doesn't have standard recipe markup. Use AI Enhanced parsing instead." }
      );
    }

    const imageUrl = extractImageUrl(html);
    const recipe = formatRecipe(jsonLd, url, imageUrl);

    log({ requestId, event: "parse_url_success", name: recipe.name });
    return jsonResponse(recipe, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "parse_url_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to parse recipe: ${message}`, corsHeaders, 500);
  }
});
