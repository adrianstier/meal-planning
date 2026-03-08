import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_IMAGE_SIZE_BYTES,
  requireCsrfHeader,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  jsonResponse,
  errorResponse,
  log,
  logError,
} from "../_shared/cors.ts";
import { callClaudeVision, extractJSON, CLAUDE_VISION_MODEL } from "../_shared/ai.ts";

interface ParsedRecipe {
  name: string;
  meal_type: string;
  ingredients: string;
  instructions: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
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
}

// Strip control characters that can break JSON parsing in clients
function sanitizeStr(s: string | undefined | null): string {
  if (!s) return "";
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function validateRecipe(parsed: Partial<ParsedRecipe>): ParsedRecipe {
  return {
    name: sanitizeStr(parsed.name?.trim()) || 'Untitled Recipe',
    meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(parsed.meal_type || '')
      ? parsed.meal_type!
      : 'dinner',
    ingredients: sanitizeStr(parsed.ingredients),
    instructions: sanitizeStr(parsed.instructions),
    prep_time_minutes: Number.isFinite(parsed.prep_time_minutes) ? Math.min(1440, Math.max(0, parsed.prep_time_minutes!)) : null,
    cook_time_minutes: Number.isFinite(parsed.cook_time_minutes) ? Math.min(1440, Math.max(0, parsed.cook_time_minutes!)) : null,
    servings: Number.isFinite(parsed.servings) && parsed.servings! > 0 ? Math.round(Math.min(100, parsed.servings!)) : 4,
    difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty || '')
      ? parsed.difficulty!
      : 'medium',
    cuisine: sanitizeStr(parsed.cuisine) || null,
    tags: sanitizeStr(parsed.tags),
    notes: sanitizeStr(parsed.notes) || null,
    calories: Number.isFinite(parsed.calories) ? Math.max(0, parsed.calories!) : null,
    protein_g: Number.isFinite(parsed.protein_g) ? Math.max(0, parsed.protein_g!) : null,
    carbs_g: Number.isFinite(parsed.carbs_g) ? Math.max(0, parsed.carbs_g!) : null,
    fat_g: Number.isFinite(parsed.fat_g) ? Math.max(0, parsed.fat_g!) : null,
    fiber_g: Number.isFinite(parsed.fiber_g) ? Math.max(0, parsed.fiber_g!) : null,
    kid_friendly_level: Math.min(10, Math.max(1, Number.isFinite(parsed.kid_friendly_level) ? parsed.kid_friendly_level! : 5)),
    makes_leftovers: parsed.makes_leftovers ?? true,
    leftover_days: Number.isFinite(parsed.leftover_days) ? parsed.leftover_days! : null,
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  // Method validation
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', corsHeaders, 405);
  }

  if (!requireCsrfHeader(req)) {
    return new Response(
      JSON.stringify({ error: 'Missing security header' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authResult = await validateJWT(req);
  if (!authResult.authenticated) {
    log({ requestId, event: 'auth_failed', error: authResult.error });
    return errorResponse(authResult.error || 'Unauthorized', corsHeaders, 401);
  }

  const rateLimitResult = checkRateLimitSync(authResult.userId!);
  if (!rateLimitResult.allowed) {
    log({ requestId, event: 'rate_limit_exceeded', userId: authResult.userId, resetIn: rateLimitResult.resetIn });
    return rateLimitExceededResponse(corsHeaders, rateLimitResult.resetIn);
  }

  // Defense-in-depth: check Content-Length header first (fast reject for honest clients),
  // then verify actual body size after reading (catches spoofed headers)
  const MAX_BODY_SIZE = 25_000_000; // 25MB limit for dual-image uploads
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return errorResponse('Request body too large', corsHeaders, 413);
  }

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

    const { image_data, image_type, original_image_data, original_image_type } = body as {
      image_data: unknown; image_type: unknown;
      original_image_data?: unknown; original_image_type?: unknown;
    };

    if (!image_data) {
      return errorResponse('Image data is required', corsHeaders, 400);
    }

    if (typeof image_data !== 'string') {
      return errorResponse('Image data must be a string', corsHeaders, 400);
    }

    // Validate image size (base64 is ~4/3 the size of binary)
    const estimatedBytes = (image_data.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse('Image too large. Maximum size is 10MB.', corsHeaders, 400);
    }

    log({ requestId, event: 'parse_image_started', imageSize: estimatedBytes, hasDualImage: !!original_image_data });

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      logError({ requestId, event: 'missing_api_key', error: 'ANTHROPIC_API_KEY not configured' });
      return errorResponse('AI service not configured', corsHeaders, 500);
    }

    // Helper to extract base64 data and media type from an image field
    function extractBase64(rawData: string, rawType: unknown): { data: string; type: string } | null {
      let b64 = rawData;
      let mtype = (typeof rawType === 'string' && rawType) ? rawType : 'image/jpeg';
      if (rawData.startsWith('data:')) {
        const matches = rawData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mtype = matches[1];
          b64 = matches[2];
        }
      }
      if (!/^[A-Za-z0-9+/\s]*={0,2}$/.test(b64.substring(0, 100))) return null;
      const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED.includes(mtype)) return null;
      return { data: b64, type: mtype };
    }

    const enhanced = extractBase64(image_data, image_type);
    if (!enhanced) {
      return errorResponse('Invalid image data encoding or unsupported type', corsHeaders, 400);
    }

    // Parse original color image if provided (for dual-image cross-reference)
    let original: { data: string; type: string } | null = null;
    if (typeof original_image_data === 'string' && original_image_data.length > 0) {
      const origEstimatedBytes = (original_image_data.length * 3) / 4;
      if (origEstimatedBytes <= MAX_IMAGE_SIZE_BYTES) {
        original = extractBase64(original_image_data, original_image_type);
      }
    }

    const hasDualImages = !!original;

    const systemPrompt = `You are a personal recipe digitization assistant. The user is photographing recipes from their own cookbooks to store in their personal meal planning app for home cooking. This is personal, non-commercial use — similar to typing a recipe into a note-taking app.

Your job is to extract the recipe data from the image into a structured JSON format. Read the text in the image carefully and accurately.

${hasDualImages ? `You are provided TWO versions of the same cookbook page:
1. IMAGE 1 (enhanced): High-contrast grayscale version optimized for text readability
2. IMAGE 2 (original): Full-color original photo with natural colors and context

CROSS-REFERENCE STRATEGY:
- Use IMAGE 1 (enhanced) as your PRIMARY source for reading text — it has better contrast for OCR.
- Use IMAGE 2 (original) to VERIFY ambiguous characters, especially: fractions (½ vs 1½), similar letters (P vs F, l vs 1), and words that seem wrong in context (e.g. "Fork" that should be "Pork").
- If the two images disagree on a character, prefer the reading that makes semantic sense in a recipe context.
` : ''}CRITICAL RULES:
- READ THE ACTUAL PRINTED TEXT in the image. Do NOT guess, invent, or generate a recipe from a food photo. Transcribe what is written. NEVER add ingredients that are not printed on the page.
- Cookbook pages often have MULTIPLE COLUMNS of ingredients. Scan the ENTIRE page systematically — left to right, top to bottom — to find ALL ingredient sections. Common sections: main protein, sauce, sides (like polenta/rice), and "For Serving" toppings. Do not skip any column.
- Transcribe ALL ingredient quantities EXACTLY as shown. Pay close attention to fractions like 1½ vs ½ — these are different amounts.
- List EVERY ingredient, including sub-sections (e.g. "Braised Pork:", "Creamy Polenta:", "For Serving:"). Format: "quantity unit ingredient (prep notes)" on each line.
- Number ALL instruction steps. Preserve section headers (e.g. "MAKE THE PORK:").
- Capture useful tips, substitutions, or personal notes from the recipe text in the "notes" field.
- Difficulty is about ACTIVE effort, not passive time. A recipe with 15 min prep + 2 hours braising is "easy", not "hard".
- Kid-friendliness (1-10): Consider familiar ingredients, mild flavors, fun presentation. Bowls with cheese/beans/corn = 7-8. Spicy/bitter/unusual textures = lower.
- Meal type: breakfast/lunch/dinner/snack — infer from context and ingredients.
- Estimate nutrition per serving from ingredients if not explicitly shown.
- For prep_time_minutes, count only hands-on time. For cook_time_minutes, count total cooking time including passive time.
`;

    const userPrompt = `I'm digitizing this recipe from my cookbook into my meal planning app. Please extract ALL the recipe data from the image${hasDualImages ? 's' : ''} into this JSON format. Read the printed text carefully — do not guess or paraphrase.

Return ONLY valid JSON:
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"ingredient1\\ningredient2\\n...","instructions":"1. Step one\\n2. Step two\\n...","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"comma,separated,tags","notes":"tips, substitutions, or other useful info from the text","calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null}`;

    // Allow env override for model
    const model = Deno.env.get('ANTHROPIC_MODEL') || CLAUDE_VISION_MODEL;

    // Send both images if original is available, otherwise just the enhanced one
    const imageDataArr = hasDualImages ? [enhanced.data, original!.data] : enhanced.data;
    const mediaTypeArr = hasDualImages ? [enhanced.type, original!.type] : enhanced.type;

    const result = await callClaudeVision(systemPrompt, userPrompt, imageDataArr, mediaTypeArr, apiKey, { model, timeoutMs: 60000 });

    // Log token usage for cost tracking
    log({
      requestId,
      event: 'ai_usage',
      model: result.model,
      inputTokens: result.usage?.input_tokens,
      outputTokens: result.usage?.output_tokens,
      userId: authResult.userId,
    });

    if (!result.text) {
      logError({ requestId, event: 'empty_ai_response', userId: authResult.userId });
      return errorResponse('No response from AI', corsHeaders, 500);
    }

    const parsed = extractJSON<ParsedRecipe>(result.text);

    if (!parsed) {
      logError({ requestId, event: 'json_parse_error', content: result.text.substring(0, 500), userId: authResult.userId });
      return errorResponse('Failed to parse AI response. Please try again.', corsHeaders, 500);
    }

    // Post-processing: fix common OCR errors in recipe text
    if (parsed.ingredients) {
      parsed.ingredients = parsed.ingredients
        // Fix "Fork" → "Pork" (common P/F confusion in scanned text)
        .replace(/\bFork\b(?=.*(?:shoulder|loin|chop|butt|belly|roast|tenderloin|rib|ground))/gi, 'Pork')
        .replace(/\b(boneless|bone-in|braised|roasted|ground|pulled)\s+Fork\b/gi, '$1 Pork')
        // Fix detached page references (e.g. "see page 123" that aren't ingredients)
        .replace(/^[\s]*(?:see\s+)?page\s+\d+.*$/gim, '')
        // Normalize fraction characters
        .replace(/\u00BD/g, '½').replace(/\u00BC/g, '¼').replace(/\u00BE/g, '¾')
        .replace(/\u2153/g, '⅓').replace(/\u2154/g, '⅔')
        // Clean up empty lines from removals
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    if (parsed.instructions) {
      parsed.instructions = parsed.instructions
        .replace(/\bFork\b(?=.*(?:shoulder|loin|chop|butt|belly|roast|tenderloin|rib|brais|season|sear))/gi, 'Pork')
        .replace(/\b(the|braised|roasted|pulled|shredded)\s+Fork\b/gi, '$1 Pork')
        .trim();
    }
    if (parsed.name) {
      parsed.name = parsed.name.replace(/\bFork\b/g, (match) => {
        // Only fix if the name likely refers to pork
        const lowerName = parsed.name!.toLowerCase();
        if (lowerName.includes('braised') || lowerName.includes('pulled') || lowerName.includes('roast') ||
            lowerName.includes('tamale') || lowerName.includes('burrito') || lowerName.includes('carnitas')) {
          return 'Pork';
        }
        return match;
      });
    }

    const recipe = validateRecipe(parsed);
    log({ requestId, event: 'parse_image_success', recipeName: recipe.name });

    return jsonResponse(recipe, corsHeaders);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResponse('Image processing timed out. Try a smaller image.', corsHeaders, 504);
    }
    logError({ requestId, event: 'parse_image_error', error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to parse recipe from image: ${message}`, corsHeaders, 500);
  }
});
