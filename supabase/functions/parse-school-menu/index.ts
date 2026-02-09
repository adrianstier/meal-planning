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

// Use Sonnet for vision capabilities (Haiku doesn't support images well)
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const ANTHROPIC_MODEL_TEXT = "claude-3-5-haiku-20241022";

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
        model: ANTHROPIC_MODEL_TEXT, // Use Haiku for text-only
        max_tokens: 3000,
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

// Call Claude with image content (uses Sonnet for vision)
async function callClaudeWithImage(
  systemPrompt: string,
  userPrompt: string,
  imageData: string,
  imageType: string,
  apiKey: string
): Promise<string> {
  // imageData should be base64 encoded, imageType should be like "image/jpeg" or "image/png"
  const mediaType = imageType.startsWith("image/") ? imageType : `image/${imageType}`;

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
        model: ANTHROPIC_MODEL, // Use Sonnet for vision
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        }],
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

function extractJSON(text: string): ParsedSchoolMenu | null {
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

      const userPrompt = `Look at this school lunch menu image and extract the meals for each day.${jsonFormatPrompt}`;

      aiResponse = await callClaudeWithImage(systemPrompt, userPrompt, image_data, image_type, apiKey);
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

      aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    } else {
      // Handle text input
      const contentToProcess = menuText.substring(0, 10000);

      const userPrompt = `Parse this school lunch menu and extract the meals for each day:

${contentToProcess}
${jsonFormatPrompt}`;

      aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    }

    const parsed = extractJSON(aiResponse);

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
