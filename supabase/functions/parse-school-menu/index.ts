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
  MAX_URL_LENGTH,
  isValidUrl,
  isPublicUrl,
} from "../_shared/cors.ts";
import { callClaude, callClaudeVision, extractJSON, CLAUDE_VISION_MODEL } from "../_shared/ai.ts";

interface SchoolMenuItem {
  date: string;
  dayOfWeek: string;
  mainDish: string;
  sides: string[];
  alternativeOptions: string[];
  allergenInfo: string[];
}

interface ParsedSchoolMenu {
  schoolName: string | null;
  weekOf: string | null;
  items: SchoolMenuItem[];
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
  // Remove scripts, styles, nav, etc.
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Convert to text
  content = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/th>/gi, " | ")
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

  // Limit for AI processing
  return content.substring(0, 10000);
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
  const MAX_BODY_SIZE = 15_000_000; // 15MB limit for image uploads
  if (contentLength > MAX_BODY_SIZE) {
    return errorResponse('Request body too large', corsHeaders, 413);
  }

  try {
    const body = await req.json();
    const { url, menuText, image_data, image_type } = body;

    // Either URL, menuText, or image_data is required
    if (!url && !menuText && !image_data) {
      return errorResponse("Please provide a school menu URL, paste the menu text, or upload a photo", corsHeaders, 400);
    }

    log({ requestId, event: "parse_school_menu_start", hasUrl: !!url, hasImage: !!image_data });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logError({ requestId, event: "missing_api_key", error: "ANTHROPIC_API_KEY not configured" });
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are an expert at parsing school cafeteria menus. Extract meal information into structured data. Handle various formats including tables, lists, and paragraphs. Always return valid JSON.`;

    const jsonFormatPrompt = `
Return JSON in this exact format:
{
  "schoolName": "School name if found or null",
  "weekOf": "Week date range if found or null",
  "items": [
    {
      "date": "2024-01-15",
      "dayOfWeek": "Monday",
      "mainDish": "Main entree",
      "sides": ["Side 1", "Side 2"],
      "alternativeOptions": ["Alternative if listed"],
      "allergenInfo": ["Contains: dairy, wheat"]
    }
  ]
}

If dates aren't specified, use the current week starting from Monday. Extract as much information as possible.`;

    let aiResponse: string;

    if (image_data) {
      // Handle image input - use vision model
      if (!image_type) {
        return errorResponse("Image type is required when uploading an image", corsHeaders, 400);
      }

      // Validate image MIME type before sending to AI
      const resolvedMediaType = image_type.startsWith("image/") ? image_type : `image/${image_type}`;
      const ALLOWED_IMAGE_TYPES_CHECK = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED_IMAGE_TYPES_CHECK.includes(resolvedMediaType)) {
        return errorResponse('Unsupported image type. Use JPEG, PNG, GIF, or WebP.', corsHeaders, 400);
      }

      const userPrompt = `Look at this school lunch menu image and extract the meals for each day.${jsonFormatPrompt}`;

      const visionResult = await callClaudeVision(
        systemPrompt, userPrompt, image_data, resolvedMediaType, apiKey,
        { model: CLAUDE_VISION_MODEL, maxTokens: 3000 }
      );
      aiResponse = visionResult.text;
    } else if (url) {
      // Handle URL input
      if (!isValidUrl(url) || url.length > MAX_URL_LENGTH) {
        return errorResponse("Valid URL is required", corsHeaders, 400);
      }

      // SSRF protection - block private/internal URLs
      if (!isPublicUrl(url)) {
        return errorResponse("URL must point to a public website", corsHeaders, 400);
      }

      let contentToProcess: string;
      try {
        const html = await fetchPage(url);
        contentToProcess = extractMainContent(html);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown";
        return errorResponse(`Failed to fetch URL: ${msg}`, corsHeaders, 422);
      }

      const userPrompt = `Parse this school lunch menu and extract the meals for each day:

${contentToProcess}
${jsonFormatPrompt}`;

      aiResponse = await callClaude(systemPrompt, userPrompt, apiKey, { maxTokens: 3000 });
    } else {
      // Handle text input
      const contentToProcess = menuText.substring(0, 10000);

      const userPrompt = `Parse this school lunch menu and extract the meals for each day:

${contentToProcess}
${jsonFormatPrompt}`;

      aiResponse = await callClaude(systemPrompt, userPrompt, apiKey, { maxTokens: 3000 });
    }

    const parsed = extractJSON<ParsedSchoolMenu>(aiResponse);

    if (!parsed || !parsed.items || parsed.items.length === 0) {
      logError({ requestId, event: "parse_school_menu_failed", reason: "no_items" });
      return errorResponse("Could not parse menu. Please try pasting the menu text directly.", corsHeaders, 500);
    }

    log({ requestId, event: "parse_school_menu_success", itemCount: parsed.items.length });

    return jsonResponse(parsed, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "parse_school_menu_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to parse school menu: ${message}`, corsHeaders, 500);
  }
});
