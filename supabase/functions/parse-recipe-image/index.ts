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

  // Read body as text first to check actual size (Content-Length can be spoofed)
  const MAX_BODY_SIZE = 15_000_000; // 15MB limit for image uploads

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

    const { image_data, image_type } = body as { image_data: unknown; image_type: unknown };

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

    log({ requestId, event: 'parse_image_started', imageSize: estimatedBytes });

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      logError({ requestId, event: 'missing_api_key', error: 'ANTHROPIC_API_KEY not configured' });
      return errorResponse('AI service not configured', corsHeaders, 500);
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = image_data;
    let mediaType = (typeof image_type === 'string' && image_type) ? image_type : 'image/jpeg';

    if (image_data.startsWith('data:')) {
      const matches = image_data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mediaType = matches[1];
        base64Data = matches[2];
      }
    }

    // Validate base64 encoding
    if (!/^[A-Za-z0-9+/\s]*={0,2}$/.test(base64Data.substring(0, 100))) {
      return errorResponse('Invalid image data encoding', corsHeaders, 400);
    }

    // Validate image MIME type
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_IMAGE_TYPES.includes(mediaType)) {
      return errorResponse('Unsupported image type. Use JPEG, PNG, GIF, or WebP.', corsHeaders, 400);
    }

    const systemPrompt = `Extract recipe data from image. Be concise.

Read: recipe cards, cookbook pages, screenshots, handwritten notes.
Infer unclear text reasonably.
Kid-friendliness (1-10): 10=kid favorites, 1=sophisticated.
Difficulty: easy (<30min), medium (30-60min), hard (>60min).
Meal type: breakfast/lunch/dinner/snack.
Estimate nutrition from ingredients if not shown.`;

    const userPrompt = `Extract recipe from image. Return JSON only:
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null}`;

    // Allow env override for model
    const model = Deno.env.get('ANTHROPIC_MODEL') || CLAUDE_VISION_MODEL;

    const result = await callClaudeVision(systemPrompt, userPrompt, base64Data, mediaType, apiKey, { model, timeoutMs: 60000 });

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
