import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  jsonResponse,
  errorResponse,
  log,
  logError,
  MAX_URL_LENGTH,
  isValidUrl,
  isPublicUrl,
  requireCsrfHeader,
} from "../_shared/cors.ts";

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

interface MenuItem {
  name: string;
  description: string | null;
  price: string | null;
  category: string;
  dietaryTags: string[];
}

interface ParsedRestaurantMenu {
  restaurantName: string | null;
  cuisine: string | null;
  menuSections: {
    name: string;
    items: MenuItem[];
  }[];
  hours: string | null;
  address: string | null;
  phone: string | null;
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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

function extractMainContent(html: string): string {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

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
    .replace(/\$(\d)/g, "$ $1") // Preserve price formatting
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

  return content.substring(0, 12000);
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJSON(text: string): ParsedRestaurantMenu | null {
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
    const { url } = body;

    if (!url || !isValidUrl(url) || url.length > MAX_URL_LENGTH) {
      return errorResponse("Valid restaurant URL is required", corsHeaders, 400);
    }

    // SSRF protection - block private/internal URLs
    if (!isPublicUrl(url)) {
      return errorResponse("URL must point to a public website", corsHeaders, 400);
    }

    log({ requestId, event: "scrape_restaurant_start", url: url.substring(0, 80) });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    let html: string;
    try {
      html = await fetchPage(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      return errorResponse(`Failed to fetch URL: ${msg}`, corsHeaders, 422);
    }

    const content = extractMainContent(html);

    const systemPrompt = `You are an expert at extracting restaurant menu information from website content. Extract menu items, prices, descriptions, and restaurant details. Always return valid JSON.`;

    const userPrompt = `Parse this restaurant website content and extract the menu:

${content}

Return JSON in this format:
{
  "restaurantName": "Restaurant name or null",
  "cuisine": "Primary cuisine type or null",
  "menuSections": [
    {
      "name": "Appetizers",
      "items": [
        {
          "name": "Dish name",
          "description": "Description or null",
          "price": "$12.99 or null",
          "category": "Appetizer",
          "dietaryTags": ["Vegetarian", "Gluten-Free"]
        }
      ]
    }
  ],
  "hours": "Operating hours if found or null",
  "address": "Address if found or null",
  "phone": "Phone if found or null"
}

Common dietary tags: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Spicy, Contains Shellfish`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON(aiResponse);

    if (!parsed) {
      logError({ requestId, event: "scrape_restaurant_failed", reason: "no_json" });
      return errorResponse("Could not parse restaurant menu. The page may not contain menu information.", corsHeaders, 500);
    }

    log({
      requestId,
      event: "scrape_restaurant_success",
      restaurant: parsed.restaurantName,
      sections: parsed.menuSections?.length || 0,
    });

    return jsonResponse(parsed, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "scrape_restaurant_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to parse restaurant menu: ${message}`, corsHeaders, 500);
  }
});
