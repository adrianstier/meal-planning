import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (match) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  }
  return null;
}

function formatJsonLdRecipe(jsonLd: any, url: string, imageUrl: string | null): ParsedRecipe {
  // Parse ingredients
  let ingredients = '';
  if (jsonLd.recipeIngredient) {
    ingredients = Array.isArray(jsonLd.recipeIngredient)
      ? jsonLd.recipeIngredient.join('\n')
      : jsonLd.recipeIngredient;
  }

  // Parse instructions
  let instructions = '';
  if (jsonLd.recipeInstructions) {
    if (Array.isArray(jsonLd.recipeInstructions)) {
      instructions = jsonLd.recipeInstructions
        .map((step: any, i: number) => {
          if (typeof step === 'string') return `${i + 1}. ${step}`;
          if (step.text) return `${i + 1}. ${step.text}`;
          if (step.itemListElement) {
            return step.itemListElement
              .map((s: any, j: number) => `${i + 1}.${j + 1}. ${s.text || s}`)
              .join('\n');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else {
      instructions = jsonLd.recipeInstructions;
    }
  }

  // Servings
  let servings = 4;
  if (jsonLd.recipeYield) {
    const yieldStr = Array.isArray(jsonLd.recipeYield)
      ? jsonLd.recipeYield[0]
      : jsonLd.recipeYield;
    const servingsMatch = String(yieldStr).match(/\d+/);
    if (servingsMatch) servings = parseInt(servingsMatch[0], 10);
  }

  // Tags from category and keywords
  const tags: string[] = [];
  if (jsonLd.recipeCategory) {
    tags.push(...(Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory : [jsonLd.recipeCategory]));
  }
  if (jsonLd.keywords) {
    const keywords = typeof jsonLd.keywords === 'string'
      ? jsonLd.keywords.split(',').map((k: string) => k.trim())
      : jsonLd.keywords;
    tags.push(...keywords);
  }

  // Determine difficulty from cook time
  const cookTime = parseDuration(jsonLd.cookTime);
  const prepTime = parseDuration(jsonLd.prepTime);
  const totalTime = (cookTime || 0) + (prepTime || 0);
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (totalTime > 0 && totalTime <= 30) difficulty = 'easy';
  else if (totalTime > 60) difficulty = 'hard';

  // Determine meal type from category
  let mealType = 'dinner';
  const category = jsonLd.recipeCategory;
  const categoryStr = Array.isArray(category) ? category.join(' ') : (category || '');
  const categoryLower = String(categoryStr).toLowerCase();
  if (categoryLower.includes('breakfast')) mealType = 'breakfast';
  else if (categoryLower.includes('lunch')) mealType = 'lunch';
  else if (categoryLower.includes('snack') || categoryLower.includes('appetizer')) mealType = 'snack';

  return {
    name: jsonLd.name || 'Untitled Recipe',
    meal_type: mealType,
    ingredients,
    instructions,
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    servings,
    difficulty,
    cuisine: jsonLd.recipeCuisine || null,
    tags: tags.slice(0, 10).join(', '),
    notes: jsonLd.description || null,
    source_url: url,
    image_url: imageUrl,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || !url.startsWith('http')) {
      return new Response(
        JSON.stringify({ error: 'Valid URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fast parsing URL:', url);
    const html = await fetchWebpage(url);

    // Try to extract structured JSON-LD data
    const jsonLd = extractJsonLd(html);

    if (!jsonLd) {
      return new Response(
        JSON.stringify({
          error: 'No structured recipe data found',
          message: 'This page doesn\'t have standard recipe markup. Try "AI Enhanced" parsing instead.',
          needsAI: true
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = extractImageUrl(html, jsonLd);
    const recipe = formatJsonLdRecipe(jsonLd, url, imageUrl);

    console.log('Successfully parsed recipe:', recipe.name);

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse recipe URL error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch or parse recipe', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
