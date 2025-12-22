import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_RECIPE_TEXT_LENGTH,
  MAX_URL_LENGTH,
  isValidUrl,
  sanitizeText,
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
  top_comments: string | null;
  source_url: string | null;
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
    const { recipe_text, source_url } = await req.json();

    // Input validation
    if (!recipe_text || recipe_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipe text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recipe_text.length > MAX_RECIPE_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Recipe text exceeds maximum length (100KB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (source_url && (source_url.length > MAX_URL_LENGTH || !isValidUrl(source_url))) {
      return new Response(
        JSON.stringify({ error: 'Invalid source URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize input
    const sanitizedText = sanitizeText(recipe_text, MAX_RECIPE_TEXT_LENGTH);
    const sanitizedUrl = source_url ? sanitizeText(source_url, MAX_URL_LENGTH) : null;

    log({ requestId, event: 'parse_recipe_started', textLength: sanitizedText.length });

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Extract structured recipe data. Be concise.

Ingredients: One per line with quantities.
Instructions: Numbered steps.
Nutrition: Estimate if not provided.
Kid-friendliness (1-10): 10=kid favorites, 1=sophisticated/spicy.
Difficulty: easy (<30min), medium (30-60min), hard (>60min).
Meal type: breakfast/lunch/dinner/snack.
Cuisine: Origin or "Fusion".
Tags: Comma-separated (quick, healthy, vegetarian, etc.).
Leftovers: 3-5 days for cooked, 1-2 for fresh.`;

    const userPrompt = `Parse recipe:

${sanitizedText}

${sanitizedUrl ? `Source: ${sanitizedUrl}` : ''}

Return JSON only:
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null,"top_comments":null,"source_url":"${sanitizedUrl || ''}"}`;

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
            content: userPrompt,
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

    // Parse the JSON response
    let parsedRecipe: ParsedRecipe;
    try {
      // Clean up potential markdown code blocks
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
      top_comments: parsedRecipe.top_comments || null,
      source_url: sanitizedUrl || parsedRecipe.source_url || null,
    };

    log({ requestId, event: 'parse_recipe_success', recipeName: recipe.name });

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError({ requestId, event: 'parse_recipe_error', error });
    return new Response(
      JSON.stringify({ error: 'Failed to parse recipe. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
