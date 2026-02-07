import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_IMAGE_SIZE_BYTES,
  requireCsrfHeader,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  handleAnthropicError,
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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  // CSRF protection
  if (!requireCsrfHeader(req)) {
    return new Response(
      JSON.stringify({ error: 'Missing security header' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate JWT authentication
  const authResult = await validateJWT(req);
  if (!authResult.authenticated) {
    log({ requestId, event: 'auth_failed', error: authResult.error });
    return errorResponse(authResult.error || 'Unauthorized', corsHeaders, 401);
  }

  // Check rate limit
  const rateLimitResult = checkRateLimitSync(authResult.userId!);
  if (!rateLimitResult.allowed) {
    log({ requestId, event: 'rate_limit_exceeded', userId: authResult.userId, resetIn: rateLimitResult.resetIn });
    return rateLimitExceededResponse(corsHeaders, rateLimitResult.resetIn);
  }

  try {
    const { image_data, image_type } = await req.json();

    if (!image_data) {
      return errorResponse('Image data is required', corsHeaders, 400);
    }

    // Validate image size (base64 is ~4/3 the size of binary)
    const estimatedBytes = (image_data.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse('Image too large. Maximum size is 10MB.', corsHeaders, 400);
    }

    log({ requestId, event: 'parse_image_started', imageSize: estimatedBytes });

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      logError({ requestId, event: 'missing_api_key', error: 'ANTHROPIC_API_KEY not configured' });
      return errorResponse('AI service not configured', corsHeaders, 500);
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = image_data;
    let mediaType = image_type || 'image/jpeg';

    if (image_data.startsWith('data:')) {
      const matches = image_data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mediaType = matches[1];
        base64Data = matches[2];
      }
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

    // 30-second timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: userPrompt,
                },
              ],
            },
          ],
          system: systemPrompt,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const { userMessage, statusCode } = handleAnthropicError(response, errorData);

      logError({
        requestId,
        event: 'anthropic_api_error',
        statusCode: response.status,
        error: errorData.error?.message || 'Unknown',
        userId: authResult.userId
      });

      return errorResponse(userMessage, corsHeaders, statusCode);
    }

    const aiResponse = await response.json();
    const content = aiResponse.content[0]?.text;

    // Log token usage for cost tracking
    log({
      requestId,
      event: 'ai_usage',
      model: aiResponse.model,
      inputTokens: aiResponse.usage?.input_tokens,
      outputTokens: aiResponse.usage?.output_tokens,
      userId: authResult.userId,
    });

    if (!content) {
      logError({ requestId, event: 'empty_ai_response', userId: authResult.userId });
      return errorResponse('No response from AI', corsHeaders, 500);
    }

    let parsedRecipe: ParsedRecipe;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedRecipe = JSON.parse(cleanJson);
    } catch (parseError) {
      logError({ requestId, event: 'json_parse_error', error: parseError, content: content.substring(0, 500), userId: authResult.userId });
      return errorResponse('Failed to parse AI response. Please try again.', corsHeaders, 500);
    }

    // Validate and set defaults
    const recipe: ParsedRecipe = {
      name: parsedRecipe.name || 'Untitled Recipe',
      meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(parsedRecipe.meal_type)
        ? parsedRecipe.meal_type
        : 'dinner',
      ingredients: parsedRecipe.ingredients || '',
      instructions: parsedRecipe.instructions || '',
      prep_time_minutes: parsedRecipe.prep_time_minutes || null,
      cook_time_minutes: parsedRecipe.cook_time_minutes || null,
      servings: parsedRecipe.servings || 4,
      difficulty: ['easy', 'medium', 'hard'].includes(parsedRecipe.difficulty)
        ? parsedRecipe.difficulty
        : 'medium',
      cuisine: parsedRecipe.cuisine || null,
      tags: parsedRecipe.tags || '',
      notes: parsedRecipe.notes || null,
      calories: parsedRecipe.calories || null,
      protein_g: parsedRecipe.protein_g || null,
      carbs_g: parsedRecipe.carbs_g || null,
      fat_g: parsedRecipe.fat_g || null,
      fiber_g: parsedRecipe.fiber_g || null,
      kid_friendly_level: Math.min(10, Math.max(1, parsedRecipe.kid_friendly_level || 5)),
      makes_leftovers: parsedRecipe.makes_leftovers ?? true,
      leftover_days: parsedRecipe.leftover_days || null,
    };

    log({ requestId, event: 'parse_image_success', recipeName: recipe.name });

    return jsonResponse(recipe, corsHeaders);

  } catch (error) {
    logError({ requestId, event: 'parse_image_error', error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to parse recipe from image: ${message}`, corsHeaders, 500);
  }
});
