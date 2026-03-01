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
import { callClaude, extractJSON } from "../_shared/ai.ts";

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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out fetching URL');
    }
    throw error;
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
    const parsed = extractJSON<ParsedRestaurantMenu>(aiResponse);

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
