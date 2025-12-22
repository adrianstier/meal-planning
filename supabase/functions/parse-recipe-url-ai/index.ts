import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  MAX_URL_LENGTH,
  isValidUrl,
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
  image_url: string | null;
}

async function fetchWebpage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function extractJsonLd(html: string): any | null {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      if (Array.isArray(data)) {
        const recipe = data.find((item: any) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      if (data['@graph']) {
        const recipe = data['@graph'].find((item: any) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      if (data['@type'] === 'Recipe' ||
          (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
        return data;
      }
    } catch (e) {
      // Continue searching
    }
  }

  return null;
}

function extractMainContent(html: string): string {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find recipe-specific content
  const recipeContainerPatterns = [
    /<article[^>]*class="[^"]*recipe[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*recipe-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*wprm-recipe[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*tasty-recipe[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of recipeContainerPatterns) {
    const match = content.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }

  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();

  return content.substring(0, 12000); // Limit content size for faster AI processing
}

function extractImageUrl(html: string, jsonLd: any): string | null {
  if (jsonLd?.image) {
    if (typeof jsonLd.image === 'string') return jsonLd.image;
    if (Array.isArray(jsonLd.image)) return jsonLd.image[0];
    if (jsonLd.image.url) return jsonLd.image.url;
  }

  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  return null;
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
    const { url } = await req.json();

    // Input validation
    if (!url || url.length > MAX_URL_LENGTH || !isValidUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Valid URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log({ requestId, event: 'ai_parse_url_start', url, userId: authResult.userId });

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Add ANTHROPIC_API_KEY to Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await fetchWebpage(url);

    const jsonLd = extractJsonLd(html);
    const imageUrl = extractImageUrl(html, jsonLd);
    const mainContent = extractMainContent(html);

    // Build context for AI
    let recipeContext = '';
    if (jsonLd) {
      recipeContext = `STRUCTURED DATA:\n${JSON.stringify(jsonLd, null, 2)}\n\n`;
    }
    recipeContext += `PAGE CONTENT:\n${mainContent}`;

    const systemPrompt = `Extract recipe data from webpage. Be concise.

Kid-friendliness (1-10): 10=kid favorites, 1=sophisticated.
Difficulty: easy (<30min), medium (30-60min), hard (>60min).`;

    const userPrompt = `Parse recipe:

${recipeContext}

Return JSON only:
{"name":"","meal_type":"breakfast|lunch|dinner|snack","ingredients":"","instructions":"","prep_time_minutes":null,"cook_time_minutes":null,"servings":4,"difficulty":"easy|medium|hard","cuisine":null,"tags":"","notes":null,"calories":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fiber_g":null,"kid_friendly_level":5,"makes_leftovers":true,"leftover_days":null,"top_comments":null}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: userPrompt }],
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

    let parsedRecipe: ParsedRecipe;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedRecipe = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and finalize recipe
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
      source_url: url,
      image_url: imageUrl,
    };

    log({ requestId, event: 'ai_parse_url_success', recipeName: recipe.name, userId: authResult.userId });

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError({ requestId, event: 'ai_parse_url_error', error, userId: authResult.userId });
    return new Response(
      JSON.stringify({ error: 'Failed to parse recipe. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
