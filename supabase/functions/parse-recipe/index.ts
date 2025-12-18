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
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { recipe_text, source_url } = await req.json();

    if (!recipe_text || recipe_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipe text is required' }),
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

    const systemPrompt = `You are an expert recipe parser and nutritionist. Your job is to extract comprehensive, structured data from recipe text.

IMPORTANT: Extract ALL available information. Be thorough and accurate.

For ingredients, format as a clean list with quantities, one per line. Include any ingredient notes (e.g., "divided", "optional").

For instructions, number each step clearly. Include timing cues, temperatures, and technique tips.

For nutrition, estimate based on standard USDA values if not explicitly provided. Be conservative with estimates.

For kid-friendliness (1-10 scale):
- 10: Universally loved (mac & cheese, pizza, chicken nuggets)
- 7-9: Generally kid-friendly with mild flavors
- 4-6: Some kids might like it, has some complex flavors
- 1-3: Sophisticated/spicy/unusual ingredients most kids dislike

For difficulty:
- easy: Under 30 min active time, basic techniques, common ingredients
- medium: 30-60 min active time, some skill required
- hard: Over 60 min active time, advanced techniques, or precise timing

For meal_type, choose the MOST appropriate: breakfast, lunch, dinner, snack

For cuisine, identify the origin (Italian, Mexican, Asian, American, Mediterranean, Indian, etc.) or "Fusion" if mixed.

For tags, include relevant categories separated by commas: quick, healthy, comfort-food, vegetarian, vegan, gluten-free, dairy-free, one-pot, meal-prep, budget-friendly, date-night, weeknight, weekend-project, etc.

For leftovers: estimate if this recipe stores well and for how many days (typically 3-5 for most cooked dishes, 1-2 for salads/fresh items).

If the recipe mentions tips, variations, or highly-rated comments from users, include the best ones in top_comments.`;

    const userPrompt = `Parse this recipe and extract ALL information into a structured format:

${recipe_text}

${source_url ? `Source URL: ${source_url}` : ''}

Return a JSON object with these fields:
{
  "name": "Recipe name (clean, title case)",
  "meal_type": "breakfast|lunch|dinner|snack",
  "ingredients": "Full ingredient list, one per line with quantities",
  "instructions": "Numbered steps with full details",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "servings": number (default 4 if not specified),
  "difficulty": "easy|medium|hard",
  "cuisine": "Cuisine type or null",
  "tags": "comma-separated relevant tags",
  "notes": "Any important tips, substitutions, or variations",
  "calories": estimated calories per serving or null,
  "protein_g": estimated protein in grams or null,
  "carbs_g": estimated carbs in grams or null,
  "fat_g": estimated fat in grams or null,
  "fiber_g": estimated fiber in grams or null,
  "kid_friendly_level": 1-10 rating,
  "makes_leftovers": true/false,
  "leftover_days": number of days leftovers keep or null,
  "top_comments": "Best tips or variations from comments if available",
  "source_url": "${source_url || 'null'}"
}

Return ONLY valid JSON, no markdown or explanation.`;

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
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI parsing failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.content[0]?.text;

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
      source_url: source_url || parsedRecipe.source_url || null,
    };

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse recipe error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
