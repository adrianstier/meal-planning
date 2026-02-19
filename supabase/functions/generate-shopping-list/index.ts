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
} from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

interface ShoppingItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  recipe: string;
  notes: string | null;
}

interface OrganizedList {
  items: ShoppingItem[];
  byCategory: Record<string, ShoppingItem[]>;
  totalItems: number;
  suggestedOrder: string[];
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  // 30-second timeout to prevent hanging requests
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
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-shopping-list] Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJSON(text: string): OrganizedList | null {
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
    const {
      startDate,
      endDate,
      includeStaples = false,
      householdSize = 4,
      dietaryNotes = [],
    } = body;

    if (!startDate || !endDate) {
      return errorResponse("Start date and end date are required", corsHeaders, 400);
    }

    log({ requestId, event: "generate_shopping_list_start", startDate, endDate });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch scheduled meal items for the date range (using scheduled_meals table)
    const { data: planItems, error: planError } = await supabase
      .from("scheduled_meals")
      .select(`
        meal_date,
        meal_type,
        servings,
        meals:meal_id (
          name,
          ingredients,
          servings
        )
      `)
      .eq("user_id", auth.userId)
      .gte("meal_date", startDate)
      .lte("meal_date", endDate);

    if (planError) {
      logError({ requestId, event: "fetch_plan_error", error: planError });
      return errorResponse("Failed to fetch meal plan", corsHeaders, 500);
    }

    if (!planItems || planItems.length === 0) {
      return errorResponse("No meals planned for this date range", corsHeaders, 400);
    }

    // Compile all ingredients from meals
    const mealIngredients: string[] = [];
    for (const item of planItems) {
      // deno-lint-ignore no-explicit-any
      const meal = item.meals as any;
      if (meal?.ingredients) {
        const servingMultiplier = (item.servings || 1) / (meal.servings || 1);
        mealIngredients.push(
          `${meal.name} (${item.meal_date}, ${item.meal_type}, ${item.servings} servings, multiplier: ${servingMultiplier.toFixed(1)}x):\n${meal.ingredients}`
        );
      }
    }

    const systemPrompt = `You are a smart shopping list organizer. Parse recipe ingredients, combine similar items, adjust quantities, and organize by grocery store sections. Be practical about combining items (e.g., "2 onions" + "1 onion" = "3 onions"). Always return valid JSON.`;

    let userPrompt = `Create a consolidated shopping list from these meal ingredients for a household of ${householdSize} people:

${mealIngredients.join("\n\n")}`;

    if (includeStaples) {
      userPrompt += `\n\nAlso suggest common pantry staples that might be needed.`;
    }

    if (dietaryNotes.length > 0) {
      userPrompt += `\n\nDietary notes: ${dietaryNotes.join(", ")}`;
    }

    userPrompt += `

Return JSON in this format:
{
  "items": [
    {"name": "Onions", "quantity": "3", "unit": "medium", "category": "Produce", "recipe": "Multiple recipes", "notes": null}
  ],
  "byCategory": {
    "Produce": [...items],
    "Dairy": [...items],
    "Meat & Seafood": [...items],
    "Pantry": [...items],
    "Frozen": [...items],
    "Bakery": [...items],
    "Other": [...items]
  },
  "totalItems": 25,
  "suggestedOrder": ["Produce", "Bakery", "Dairy", "Meat & Seafood", "Frozen", "Pantry", "Other"]
}

Categories to use: Produce, Dairy, Meat & Seafood, Pantry, Frozen, Bakery, Beverages, Condiments, Other

Combine duplicate ingredients intelligently. Round quantities appropriately. Note which recipe(s) need each item.`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const parsed = extractJSON(aiResponse);

    if (!parsed || !parsed.items || parsed.items.length === 0) {
      logError({ requestId, event: "generate_shopping_list_failed", reason: "no_items" });
      return errorResponse("Failed to generate shopping list. Please try again.", corsHeaders, 500);
    }

    log({ requestId, event: "generate_shopping_list_success", itemCount: parsed.totalItems });

    return jsonResponse(parsed, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "generate_shopping_list_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to generate shopping list: ${message}`, corsHeaders, 500);
  }
});
