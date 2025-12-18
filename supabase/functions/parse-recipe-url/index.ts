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
  // Look for JSON-LD recipe schema
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Handle array of schemas
      if (Array.isArray(data)) {
        const recipe = data.find((item: any) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      // Handle @graph structure
      if (data['@graph']) {
        const recipe = data['@graph'].find((item: any) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      // Direct recipe object
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
  // Remove scripts and styles
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
    /<div[^>]*id="[^"]*recipe[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of recipeContainerPatterns) {
    const match = content.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }

  // Strip remaining HTML tags but keep structure
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

  return content.substring(0, 15000); // Limit content size
}

function extractImageUrl(html: string, jsonLd: any): string | null {
  // Try JSON-LD first
  if (jsonLd?.image) {
    if (typeof jsonLd.image === 'string') return jsonLd.image;
    if (Array.isArray(jsonLd.image)) return jsonLd.image[0];
    if (jsonLd.image.url) return jsonLd.image.url;
  }

  // Look for Open Graph image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  // Look for recipe image in common patterns
  const imgPatterns = [
    /<img[^>]*class="[^"]*recipe[^"]*image[^"]*"[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*class="[^"]*hero[^"]*"[^>]*src=["']([^"']+)["']/i,
  ];

  for (const pattern of imgPatterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractCommentsAndTips(html: string): string | null {
  const comments: string[] = [];

  // Look for highly-rated comments or tips sections
  const commentPatterns = [
    /<div[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<li[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  ];

  for (const pattern of commentPatterns) {
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null && count < 3) {
      const text = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 50 && text.length < 500) {
        comments.push(text);
        count++;
      }
    }
  }

  return comments.length > 0 ? comments.join('\n\n') : null;
}

function formatJsonLdRecipe(jsonLd: any): Partial<ParsedRecipe> {
  const result: Partial<ParsedRecipe> = {};

  result.name = jsonLd.name || null;

  // Parse ingredients
  if (jsonLd.recipeIngredient) {
    result.ingredients = Array.isArray(jsonLd.recipeIngredient)
      ? jsonLd.recipeIngredient.join('\n')
      : jsonLd.recipeIngredient;
  }

  // Parse instructions
  if (jsonLd.recipeInstructions) {
    if (Array.isArray(jsonLd.recipeInstructions)) {
      result.instructions = jsonLd.recipeInstructions
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
      result.instructions = jsonLd.recipeInstructions;
    }
  }

  // Parse times (ISO 8601 duration format)
  const parseDuration = (duration: string): number | null => {
    if (!duration) return null;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
    if (match) {
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      return hours * 60 + minutes;
    }
    return null;
  };

  result.prep_time_minutes = parseDuration(jsonLd.prepTime);
  result.cook_time_minutes = parseDuration(jsonLd.cookTime);

  // Servings
  if (jsonLd.recipeYield) {
    const yieldStr = Array.isArray(jsonLd.recipeYield)
      ? jsonLd.recipeYield[0]
      : jsonLd.recipeYield;
    const servingsMatch = String(yieldStr).match(/\d+/);
    result.servings = servingsMatch ? parseInt(servingsMatch[0], 10) : 4;
  }

  // Cuisine and category
  result.cuisine = jsonLd.recipeCuisine || null;

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
  result.tags = tags.join(', ');

  // Nutrition
  if (jsonLd.nutrition) {
    const parseNutrient = (value: string | number): number | null => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const match = value.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : null;
      }
      return null;
    };

    result.calories = parseNutrient(jsonLd.nutrition.calories);
    result.protein_g = parseNutrient(jsonLd.nutrition.proteinContent);
    result.carbs_g = parseNutrient(jsonLd.nutrition.carbohydrateContent);
    result.fat_g = parseNutrient(jsonLd.nutrition.fatContent);
    result.fiber_g = parseNutrient(jsonLd.nutrition.fiberContent);
  }

  // Description as notes
  result.notes = jsonLd.description || null;

  return result;
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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the webpage
    console.log('Fetching URL:', url);
    const html = await fetchWebpage(url);

    // Try to extract structured data first
    const jsonLd = extractJsonLd(html);
    const structuredData = jsonLd ? formatJsonLdRecipe(jsonLd) : {};
    const imageUrl = extractImageUrl(html, jsonLd);
    const topComments = extractCommentsAndTips(html);
    const mainContent = extractMainContent(html);

    console.log('Found JSON-LD:', !!jsonLd);
    console.log('Found image:', !!imageUrl);

    // Build context for AI
    let recipeContext = '';
    if (Object.keys(structuredData).length > 0) {
      recipeContext = `STRUCTURED DATA FOUND:\n${JSON.stringify(structuredData, null, 2)}\n\n`;
    }
    recipeContext += `PAGE CONTENT:\n${mainContent}`;

    const systemPrompt = `You are an expert recipe parser. Extract comprehensive recipe data from webpage content.

You may receive both structured data (JSON-LD) and raw page content. Use structured data when available but verify and enhance with page content.

IMPORTANT: Extract ALL available information. Fill in reasonable estimates for nutrition if not provided.

For kid-friendliness (1-10 scale):
- 10: Universally loved (mac & cheese, pizza, chicken nuggets)
- 7-9: Generally kid-friendly with mild flavors
- 4-6: Some kids might like it
- 1-3: Sophisticated/spicy foods most kids dislike

For difficulty: easy (<30min active), medium (30-60min), hard (>60min or advanced techniques)

For meal_type: breakfast, lunch, dinner, or snack (pick most appropriate)`;

    const userPrompt = `Parse this recipe from ${url}:

${recipeContext}

${topComments ? `\nUSER COMMENTS/TIPS:\n${topComments}` : ''}

Return a JSON object with:
{
  "name": "Recipe name (clean, title case)",
  "meal_type": "breakfast|lunch|dinner|snack",
  "ingredients": "Full ingredient list, one per line with quantities",
  "instructions": "Numbered steps with full details",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "servings": number,
  "difficulty": "easy|medium|hard",
  "cuisine": "Cuisine type or null",
  "tags": "comma-separated tags",
  "notes": "Tips, substitutions, or important notes from the recipe",
  "calories": number or null,
  "protein_g": number or null,
  "carbs_g": number or null,
  "fat_g": number or null,
  "fiber_g": number or null,
  "kid_friendly_level": 1-10,
  "makes_leftovers": true/false,
  "leftover_days": number or null,
  "top_comments": "Best tips from user comments if available"
}

Return ONLY valid JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI parsing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.content[0]?.text;

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

    // Add extracted data
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
      top_comments: parsedRecipe.top_comments || topComments,
      source_url: url,
      image_url: imageUrl,
    };

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse recipe URL error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to parse recipe', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
