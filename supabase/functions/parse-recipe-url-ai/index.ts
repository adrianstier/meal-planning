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
  source_url: string;
  image_url: string | null;
  // deno-lint-ignore no-explicit-any
  top_comments: any;
}

interface FetchResult {
  html: string | null;
  text: string | null;
  usedFallback: boolean;
}

async function fetchPage(url: string): Promise<FetchResult> {
  // Try direct fetch first
  try {
    const html = await directFetch(url);
    return { html, text: null, usedFallback: false };
  } catch (directError) {
    const msg = directError instanceof Error ? directError.message : "";
    console.log(`Direct fetch failed (${msg}), trying Jina Reader fallback...`);
  }

  // Fallback: use Jina Reader API for sites with bot protection
  try {
    const text = await jinaReaderFetch(url);
    return { html: null, text, usedFallback: true };
  } catch (fallbackError) {
    const msg = fallbackError instanceof Error ? fallbackError.message : "Unknown";
    throw new Error(`Could not access recipe page: ${msg}`);
  }
}

async function directFetch(url: string): Promise<string> {
  const MAX_HTML_SIZE = 5_000_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    let response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    // Handle redirects safely - validate each hop against SSRF
    let hops = 0;
    const MAX_REDIRECTS = 5;
    while (response.status >= 300 && response.status < 400) {
      if (hops >= MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect with no location');
      const redirectUrl = new URL(location, url).href;
      if (!isPublicUrl(redirectUrl)) {
        throw new Error('Redirect to non-public URL blocked');
      }
      response = await fetch(redirectUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      hops++;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Validate content-type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('application/xhtml') && !contentType.includes('application/xml')) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    // Check response size before reading body
    const clHeader = response.headers.get('content-length');
    if (clHeader && parseInt(clHeader, 10) > MAX_HTML_SIZE) {
      throw new Error('Response too large');
    }

    const text = await response.text();
    if (text.length > MAX_HTML_SIZE) {
      throw new Error('Response too large');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function jinaReaderFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  try {
    // URL is already validated as public by isPublicUrl() in the main handler
    // Use text/plain mode — JSON mode returns empty content for many sites
    const response = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        "Accept": "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`Jina Reader returned ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.length < 100) {
      throw new Error("No content returned from Jina Reader");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function extractImageUrl(html: string): string | null {
  // Use lookahead patterns to handle attributes in any order
  const ogMatch = html.match(/<meta(?=[^>]*property=["']og:image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i);
  if (ogMatch) return ogMatch[1];

  const twitterMatch = html.match(/<meta(?=[^>]*name=["']twitter:image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i);
  if (twitterMatch) return twitterMatch[1];

  return null;
}

function extractMainContent(html: string): string {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

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

  content = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

  return content.substring(0, 8000);
}

function extractCommentSection(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const patterns = [
    /<section[^>]*(?:id|class)="[^"]*(?:comment|review)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*(?:id|class)="[^"]*(?:comments|reviews|user-review)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<(?:footer|aside|div[^>]*class="[^"]*(?:footer|sidebar)))/i,
    /<ol[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/ol>/i,
    /<ul[^>]*class="[^"]*(?:comment|review)[^"]*"[^>]*>([\s\S]*?)<\/ul>/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 3000);
    }
  }
  return "";
}

// deno-lint-ignore no-explicit-any
function extractJsonLd(html: string): any | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          return item;
        }
        if (item["@graph"]) {
          // deno-lint-ignore no-explicit-any
          const recipe = item["@graph"].find((g: any) =>
            g["@type"] === "Recipe" || (Array.isArray(g["@type"]) && g["@type"].includes("Recipe"))
          );
          if (recipe) return recipe;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Strip control characters (except \n \r \t) that can break JSON parsing in clients
function sanitizeStr(s: string | undefined | null): string {
  if (!s) return "";
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function validateRecipe(parsed: Partial<ParsedRecipe>, url: string, imageUrl: string | null): ParsedRecipe {
  return {
    name: sanitizeStr(parsed.name?.trim()) || "Untitled Recipe",
    meal_type: ["breakfast", "lunch", "dinner", "snack"].includes(parsed.meal_type || "") ? parsed.meal_type! : "dinner",
    ingredients: sanitizeStr(parsed.ingredients),
    instructions: sanitizeStr(parsed.instructions),
    prep_time_minutes: Number.isFinite(parsed.prep_time_minutes) && parsed.prep_time_minutes! >= 0
      ? Math.min(Math.round(parsed.prep_time_minutes!), 1440) : null,
    cook_time_minutes: Number.isFinite(parsed.cook_time_minutes) && parsed.cook_time_minutes! >= 0
      ? Math.min(Math.round(parsed.cook_time_minutes!), 1440) : null,
    servings: Number.isFinite(parsed.servings) && parsed.servings! > 0
      ? Math.min(Math.round(parsed.servings!), 100) : 4,
    difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty || "") ? parsed.difficulty! : "medium",
    cuisine: sanitizeStr(parsed.cuisine) || null,
    tags: sanitizeStr(parsed.tags),
    notes: sanitizeStr(parsed.notes) || null,
    calories: Number.isFinite(parsed.calories) && parsed.calories! >= 0
      ? Math.round(parsed.calories!) : null,
    protein_g: Number.isFinite(parsed.protein_g) && parsed.protein_g! >= 0
      ? Math.round(parsed.protein_g! * 10) / 10 : null,
    carbs_g: Number.isFinite(parsed.carbs_g) && parsed.carbs_g! >= 0
      ? Math.round(parsed.carbs_g! * 10) / 10 : null,
    fat_g: Number.isFinite(parsed.fat_g) && parsed.fat_g! >= 0
      ? Math.round(parsed.fat_g! * 10) / 10 : null,
    fiber_g: Number.isFinite(parsed.fiber_g) && parsed.fiber_g! >= 0
      ? Math.round(parsed.fiber_g! * 10) / 10 : null,
    kid_friendly_level: Math.min(10, Math.max(1, Number.isFinite(parsed.kid_friendly_level) ? Math.round(parsed.kid_friendly_level!) : 5)),
    makes_leftovers: typeof parsed.makes_leftovers === "boolean" ? parsed.makes_leftovers : true,
    leftover_days: Number.isFinite(parsed.leftover_days) && parsed.leftover_days! >= 0
      ? Math.round(parsed.leftover_days!) : null,
    source_url: url,
    image_url: imageUrl || parsed.image_url || null,
    top_comments: Array.isArray(parsed.top_comments)
      ? JSON.stringify(parsed.top_comments)
      : typeof parsed.top_comments === "string"
        ? parsed.top_comments
        : null,
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', corsHeaders, 405);
  }

  if (!requireCsrfHeader(req)) {
    return new Response(
      JSON.stringify({ error: 'Missing security header' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  // Read body as text first to enforce size limit (Content-Length can be spoofed)
  const MAX_BODY_SIZE = 100_000; // 100KB limit

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return errorResponse('Request body too large', corsHeaders, 413);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON', corsHeaders, 400);
    }

    const url = body.url;

    if (!url || typeof url !== 'string' || !isValidUrl(url) || url.length > MAX_URL_LENGTH) {
      return errorResponse("Valid URL is required", corsHeaders, 400);
    }

    if (!isPublicUrl(url)) {
      return errorResponse("URL must point to a public website", corsHeaders, 400);
    }

    log({ requestId, event: "ai_parse_start", url: url.substring(0, 80) });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logError({ requestId, event: "missing_api_key", error: "ANTHROPIC_API_KEY not configured" });
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    let fetchResult: FetchResult;
    try {
      fetchResult = await fetchPage(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      return errorResponse(`Failed to fetch URL: ${msg}`, corsHeaders, 422);
    }

    let imageUrl: string | null = null;
    let context = "";

    if (fetchResult.html) {
      // Direct fetch succeeded - extract structured data from HTML
      imageUrl = extractImageUrl(fetchResult.html);
      const jsonLd = extractJsonLd(fetchResult.html);
      const mainContent = extractMainContent(fetchResult.html);

      if (jsonLd) {
        const jsonLdStr = JSON.stringify(jsonLd, null, 2).substring(0, 5000);
        context = `STRUCTURED DATA:\n${jsonLdStr}\n\n`;
      }
      context += `PAGE CONTENT:\n${mainContent}`;

      const commentSection = extractCommentSection(fetchResult.html);
      if (commentSection) {
        context += `\n\nUSER COMMENTS/REVIEWS:\n${commentSection}`;
      }
    } else if (fetchResult.text) {
      // Jina Reader fallback - content is already extracted text/markdown
      // Smart extraction: skip navigation boilerplate, find recipe content
      const jinaText = fetchResult.text;
      let recipeContent = jinaText;

      // Try to find where recipe content starts by looking for common recipe markers
      const markers = [
        /(?:^|\n)#+\s*(?:ingredients|recipe)/im,
        /(?:^|\n)(?:ingredients|directions|instructions|recipe)\s*\n/im,
        /(?:^|\n)\*\*(?:ingredients|directions|instructions)\*\*/im,
        /(?:^|\n)(?:prep time|cook time|total time|servings|yield)/im,
        /(?:^|\n)(?:\d+\s+(?:cup|tbsp|tsp|oz|lb|pound|clove|can)\b)/im,
      ];

      for (const marker of markers) {
        const match = jinaText.search(marker);
        if (match > 0) {
          // Include some context before the match (up to 500 chars)
          const start = Math.max(0, match - 500);
          recipeContent = jinaText.substring(start);
          break;
        }
      }

      context = `PAGE CONTENT:\n${recipeContent.substring(0, 15000)}`;
      log({ requestId, event: "using_jina_fallback", contentLength: recipeContent.length });
    }

    const systemPrompt = `You are a recipe parser. Extract recipe data and return ONLY valid JSON, no other text.

Format ingredients as one per line with quantities.
Format instructions as numbered steps.
Estimate nutrition if not provided.
Kid-friendliness: 1-10 (10 = kid favorites like mac & cheese, 1 = spicy/complex)
Difficulty: easy (<30min total), medium (30-60min), hard (>60min)
If the page contains user comments or reviews, extract the top 3 most helpful ones (prefer tips, substitutions, or cooking adjustments). Format as a JSON array of {"text":"...","upvotes":0} where upvotes is the number if shown, or 0.`;

    const userPrompt = `Parse this recipe into JSON:

${context}

Return this exact JSON structure (no markdown, no explanation):
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null,"top_comments":null}`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON<ParsedRecipe>(aiResponse);

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
