import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_IMAGE_SIZE_BYTES,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  handleAnthropicError,
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

  // Validate JWT authentication
  const authResult = await validateJWT(req);
  if (!authResult.authenticated) {
    log({ requestId, event: 'auth_failed', error: authResult.error });
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: authResult.error }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate image size (base64 is ~4/3 the size of binary)
    const estimatedBytes = (image_data.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Maximum size is 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log({ requestId, event: 'parse_image_started', imageSize: estimatedBytes });

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514',
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
    });

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

      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedRecipe: ParsedRecipe;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedRecipe = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError({ requestId, event: 'parse_image_error', error });
    return new Response(
      JSON.stringify({ error: 'Failed to parse recipe from image. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
