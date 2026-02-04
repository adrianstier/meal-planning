/**
 * Agent Edge Function
 *
 * Main endpoint for multi-agent AI interactions.
 * Simple implementation using direct Anthropic API calls.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ============================================
// CORS Utilities (inline)
// ============================================
// Get allowed origins from environment variable, with fallback to defaults
const ENV_ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS');
const ALLOWED_ORIGINS = ENV_ALLOWED_ORIGINS
  ? ENV_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://meal-planning-virid.vercel.app',
      'https://meal-planning-adrianstiers-projects.vercel.app',
      'https://meal-planning-git-main-adrianstiers-projects.vercel.app',
      'https://client-six-inky.vercel.app',
    ];

const VERCEL_PREVIEW_PATTERN = /^https:\/\/(meal-planning|client)-[a-z0-9]+-adrian-stiers-projects(-807dad27)?\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = isAllowedOrigin(requestOrigin) ? requestOrigin! : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '3600',
  };
}

function handleCorsPrelight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) });
  }
  return null;
}

// ============================================
// Rate Limiting (Database-backed)
// ============================================
// Uses database-backed rate limiting via check_rate_limit() function
// This persists across Deno worker restarts unlike in-memory Map
const RATE_LIMIT = 30 // requests per minute
const RATE_WINDOW_SECONDS = 60 // 1 minute
const RATE_LIMIT_ENDPOINT = 'agent'

interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<RateLimitResult> {
  try {
    // Call the database function to atomically check and increment rate limit
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: RATE_LIMIT_ENDPOINT,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    })

    if (error) {
      console.error('[Agent] Rate limit check error:', error)
      // On database error, fail open to avoid blocking legitimate requests
      // but log for monitoring
      return { allowed: true }
    }

    if (data === true) {
      return { allowed: true }
    }

    // Rate limit exceeded - get retry-after time
    const { data: retryAfter } = await supabase.rpc('get_rate_limit_retry_after', {
      p_user_id: userId,
      p_endpoint: RATE_LIMIT_ENDPOINT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    })

    return {
      allowed: false,
      retryAfter: retryAfter || RATE_WINDOW_SECONDS,
    }
  } catch (err) {
    console.error('[Agent] Rate limit check exception:', err)
    // Fail open on unexpected errors
    return { allowed: true }
  }
}

// ============================================
// AI Integration
// ============================================
const AI_TIMEOUT_MS = 30000 // 30 second timeout for Anthropic API calls

class AITimeoutError extends Error {
  constructor() {
    super('AI request timed out')
    this.name = 'AITimeoutError'
  }
}

async function callAI(systemPrompt: string, userMessage: string): Promise<{ content: string; usage: { input: number; output: number } }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Log full error server-side for debugging
      console.error(`[Agent] Anthropic API error: ${response.status} - ${errorText}`)
      // Throw generic error for client (don't expose raw API error details)
      throw new Error('AI service temporarily unavailable')
    }

    const data = await response.json()
    const content = data.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text || '')
      .join('')

    return {
      content,
      usage: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AITimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================
// Main Handler
// ============================================
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req)
  if (preflightResponse) {
    return preflightResponse
  }

  const startTime = Date.now()

  try {
    // CSRF Protection: Require custom header to prevent cross-site request forgery
    const xRequestedWith = req.headers.get('X-Requested-With')
    if (xRequestedWith !== 'XMLHttpRequest') {
      return new Response(
        JSON.stringify({ error: 'Missing required security header' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Initialize Supabase client with user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check rate limit (database-backed for persistence across worker restarts)
    const rateCheck = await checkRateLimit(supabase, user.id)
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateCheck.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter),
          },
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const { message, metadata, conversationId: requestedConversationId } = body

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (message.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 10000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate metadata if present (limit size to prevent abuse)
    const MAX_METADATA_SIZE = 4096 // 4KB limit for metadata
    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return new Response(
          JSON.stringify({ error: 'Metadata must be a valid object' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const metadataString = JSON.stringify(metadata)
      if (metadataString.length > MAX_METADATA_SIZE) {
        return new Response(
          JSON.stringify({ error: `Metadata too large (max ${MAX_METADATA_SIZE} bytes)` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Validate and track conversation ID
    let conversationId: string
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (requestedConversationId) {
      if (typeof requestedConversationId !== 'string' || !uuidRegex.test(requestedConversationId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid conversation ID format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      conversationId = requestedConversationId
    } else {
      conversationId = crypto.randomUUID()
    }

    console.log(`[Agent] Processing request from user ${user.id}: "${message.slice(0, 100)}..."`)

    // Load user's recipes for context
    const { data: recipes } = await supabase
      .from('meals')
      .select('name, cuisine, meal_type, difficulty')
      .eq('user_id', user.id)
      .limit(10)

    const recipeContext = recipes?.length
      ? `User has ${recipes.length} recipes saved: ${recipes.map(r => r.name).join(', ')}`
      : 'User has no recipes saved yet.'

    // Load active leftovers
    const { data: leftovers } = await supabase
      .from('leftovers_inventory')
      .select('meals(name), servings_remaining, expiry_date')
      .eq('user_id', user.id)
      .gt('expiry_date', new Date().toISOString())
      .gt('servings_remaining', 0)

    const leftoverContext = leftovers?.length
      ? `Active leftovers: ${leftovers.map(l => `${(l.meals as any)?.name || 'Unknown'} (${l.servings_remaining} servings)`).join(', ')}`
      : 'No active leftovers.'

    // Call AI with comprehensive system prompt
    const systemPrompt = `You are a helpful meal planning AI assistant. You help users with:

**Recipe Management:**
- Save recipes from URLs, text, or images
- Organize and search their recipe collection
- Get cooking tips and variations

**Meal Planning:**
- Create weekly meal plans
- Suggest meals based on preferences
- Use up leftovers before they expire
- Balance nutrition throughout the week

**Shopping:**
- Generate shopping lists from meal plans
- Organize items by store section
- Estimate costs

**Nutrition:**
- Analyze recipe nutrition
- Check dietary compliance (keto, vegan, etc.)
- Suggest healthier substitutions
- Flag allergens

Be friendly, helpful, and concise. Format responses with markdown for readability.

**User Context:**
${recipeContext}
${leftoverContext}

When the user wants to:
- Add a recipe: Ask them to paste a URL or the recipe text
- Plan meals: Ask what days they want to plan and any preferences
- Make a shopping list: Confirm which meals to include`

    const aiResponse = await callAI(systemPrompt, message)

    const executionTime = Date.now() - startTime
    console.log(`[Agent] Completed in ${executionTime}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        message: aiResponse.content,
        conversationId: conversationId,
        executionTimeMs: executionTime,
        data: {
          usage: aiResponse.usage,
          recipesLoaded: recipes?.length || 0,
          leftoverCount: leftovers?.length || 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    // Log full error server-side for debugging
    console.error('[Agent] Unhandled error:', error)
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)

    // Handle specific error types with appropriate client messages
    if (error instanceof AITimeoutError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request timed out',
          message: 'The AI service took too long to respond. Please try again.',
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return generic error to client (don't expose internal error details)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
        message: 'Something went wrong. Please try again later.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
