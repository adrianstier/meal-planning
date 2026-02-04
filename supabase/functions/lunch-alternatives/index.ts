import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getCorsHeaders,
  handleCorsPrelight,
  validateJWT,
  checkRateLimitSync,
  rateLimitExceededResponse,
  jsonResponse,
  errorResponse,
  log,
  logError,
} from "../_shared/cors.ts";

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

interface LunchAlternative {
  name: string;
  description: string;
  type: string;
  portionSize: string;
  nutritionNotes: string;
  prepInstructions: string;
  packingTips: string;
}

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function extractJSON(text: string): LunchAlternative[] | null {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\[[\s\S]*\])/,
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
      schoolMeal = "",
      dietaryRestrictions = [],
      preferences = [],
      packingConstraints = [],
      childAge = "elementary",
    } = body;

    if (!schoolMeal) {
      return errorResponse("Please provide the school meal to find alternatives for", corsHeaders, 400);
    }

    log({ requestId, event: "lunch_alternatives_start", schoolMeal });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service not configured", corsHeaders, 500);
    }

    const systemPrompt = `You are a helpful parent assistant who suggests healthy, kid-friendly lunch alternatives when children don't want to eat the school cafeteria meal. Focus on practical, packable options. Always return valid JSON array.`;

    let userPrompt = `Today's school cafeteria meal is: ${schoolMeal}

My child (${childAge} school age) doesn't want to eat this.`;

    if (dietaryRestrictions.length > 0) {
      userPrompt += ` Dietary restrictions: ${dietaryRestrictions.join(", ")}.`;
    }

    if (preferences.length > 0) {
      userPrompt += ` Child's food preferences: ${preferences.join(", ")}.`;
    }

    if (packingConstraints.length > 0) {
      userPrompt += ` Packing constraints: ${packingConstraints.join(", ")}.`;
    }

    userPrompt += `

Suggest 4 alternative packed lunch ideas. Return a JSON array:
[{"name":"Lunch Name","description":"What it includes","type":"hot|cold|room-temp","portionSize":"appropriate for age","nutritionNotes":"Key nutrients","prepInstructions":"Quick prep steps","packingTips":"How to pack safely"}]

Types:
- hot: Needs thermos/insulated container
- cold: Needs ice pack
- room-temp: Safe at room temperature`;

    const aiResponse = await callClaude(systemPrompt, userPrompt, apiKey);
    const alternatives = extractJSON(aiResponse);

    if (!alternatives || alternatives.length === 0) {
      logError({ requestId, event: "lunch_alternatives_failed", reason: "no_alternatives" });
      return errorResponse("Failed to generate alternatives. Please try again.", corsHeaders, 500);
    }

    log({ requestId, event: "lunch_alternatives_success", count: alternatives.length });

    return jsonResponse({ alternatives }, corsHeaders);

  } catch (error) {
    logError({ requestId, event: "lunch_alternatives_error", error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Failed to suggest lunch alternatives: ${message}`, corsHeaders, 500);
  }
});
