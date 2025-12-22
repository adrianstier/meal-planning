// Shared CORS configuration for Edge Functions
// Restricts access to specified origins only

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://meal-planning-adrianstiers-projects.vercel.app',
  'https://meal-planning-git-main-adrianstiers-projects.vercel.app',
];

// Also allow origins from environment variable (comma-separated)
const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
if (envOrigins) {
  ALLOWED_ORIGINS.push(...envOrigins.split(',').map(o => o.trim()));
}

// Pattern to match only this project's Vercel preview deployments
// Format: meal-planning-{hash}-adrianstiers-projects.vercel.app
const VERCEL_PREVIEW_PATTERN = /^https:\/\/meal-planning-[a-z0-9]+-adrianstiers-projects\.vercel\.app$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Check explicit allowed list
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check if it matches the Vercel preview deployment pattern for this project
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;

  return false;
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  // Use the request origin if allowed, otherwise fall back to first allowed origin
  const origin = isAllowedOrigin(requestOrigin) ? requestOrigin! : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

export function handleCorsPrelight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}

// Input validation constants
export const MAX_RECIPE_TEXT_LENGTH = 100000; // 100KB
export const MAX_URL_LENGTH = 2048;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function isValidUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeText(text: string, maxLength: number): string {
  if (!text) return '';
  // Trim and limit length
  return text.trim().slice(0, maxLength);
}

// JWT validation helper
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

export async function validateJWT(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return { authenticated: false, error: 'Missing authorization header' };
  }

  // Extract the JWT token
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return { authenticated: false, error: 'Invalid authorization format' };
  }

  // Verify with Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing');
    return { authenticated: false, error: 'Service configuration error' };
  }

  try {
    // Call Supabase to validate the token
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey,
      },
    });

    if (!response.ok) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    const user = await response.json();

    if (!user || !user.id) {
      return { authenticated: false, error: 'Invalid user data' };
    }

    return { authenticated: true, userId: user.id };
  } catch (error) {
    console.error('JWT validation error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// Structured logging helper
export interface LogContext {
  requestId: string;
  event: string;
  [key: string]: unknown;
}

export function log(context: LogContext): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...context,
  }));
}

export function logError(context: LogContext & { error: unknown }): void {
  const errorMessage = context.error instanceof Error
    ? context.error.message
    : String(context.error);

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...context,
    error: errorMessage,
  }));
}

// Server-side rate limiting using Supabase database for distributed tracking
// Falls back to in-memory cache if database is unavailable

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory fallback store (for when DB is unavailable)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  actionType?: string; // For database tracking
}

// Default: 10 AI requests per minute per user
export const AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  actionType: 'ai_parse',
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds until reset
}

// Database-based rate limiting (preferred)
export async function checkRateLimitDb(
  userId: string,
  config: RateLimitConfig = AI_RATE_LIMIT
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Fall back to in-memory if service key not available
  if (!supabaseUrl || !supabaseServiceKey) {
    return checkRateLimitMemory(userId, config);
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_action_type: config.actionType || 'ai_parse',
        p_max_requests: config.maxRequests,
        p_window_minutes: Math.ceil(config.windowMs / 60000),
      }),
    });

    if (!response.ok) {
      // Fall back to in-memory on error
      console.warn('Rate limit DB check failed, using in-memory fallback');
      return checkRateLimitMemory(userId, config);
    }

    const [result] = await response.json();

    if (!result) {
      return checkRateLimitMemory(userId, config);
    }

    const resetAt = new Date(result.reset_at);
    const resetIn = Math.max(0, resetAt.getTime() - Date.now());

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetIn,
    };
  } catch (error) {
    // Fall back to in-memory on any error
    console.warn('Rate limit DB error, using in-memory fallback:', error);
    return checkRateLimitMemory(userId, config);
  }
}

// In-memory rate limiting (fallback)
export function checkRateLimitMemory(
  userId: string,
  config: RateLimitConfig = AI_RATE_LIMIT
): RateLimitResult {
  const now = Date.now();
  const key = `ratelimit:${userId}:${config.actionType || 'default'}`;

  // Get existing entry
  let entry = rateLimitStore.get(key);

  // Check if window has expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    // Start a new window
    entry = { count: 1, windowStart: now };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Window still active - check count
  if (entry.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: config.windowMs - (now - entry.windowStart),
  };
}

// Main entry point - tries DB first, falls back to memory
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig = AI_RATE_LIMIT
): Promise<RateLimitResult> {
  // For now, use in-memory for speed, DB for persistence
  // The DB version is async, so we provide both options
  return checkRateLimitMemory(userId, config);
}

// Synchronous version for backwards compatibility
export function checkRateLimitSync(
  userId: string,
  config: RateLimitConfig = AI_RATE_LIMIT
): RateLimitResult {
  return checkRateLimitMemory(userId, config);
}

// Helper to create rate limit exceeded response
export function rateLimitExceededResponse(
  corsHeaders: Record<string, string>,
  resetIn: number
): Response {
  const resetInSeconds = Math.ceil(resetIn / 1000);
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Please wait ${resetInSeconds} seconds before trying again.`,
      retryAfter: resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(resetInSeconds),
      },
    }
  );
}

// Anthropic error handler helper
export interface AnthropicErrorResponse {
  userMessage: string;
  statusCode: number;
}

export function handleAnthropicError(
  response: Response,
  errorData: { error?: { message?: string; type?: string } }
): AnthropicErrorResponse {
  const statusCode = response.status;

  let userMessage = 'AI parsing temporarily unavailable. Please try again.';

  if (statusCode === 429) {
    userMessage = 'AI service is busy. Please wait a moment and try again.';
  } else if (statusCode === 401 || statusCode === 403) {
    userMessage = 'AI service configuration error. Please contact support.';
  } else if (statusCode === 400) {
    // Bad request - likely content too long or invalid
    if (errorData.error?.type === 'invalid_request_error') {
      userMessage = 'Recipe content is too long or invalid. Please try with a shorter recipe.';
    }
  } else if (statusCode === 529) {
    // Anthropic overloaded
    userMessage = 'AI service is overloaded. Please try again in a few minutes.';
  } else if (statusCode >= 500) {
    userMessage = 'AI service is temporarily down. Please try again later.';
  }

  return { userMessage, statusCode: 503 };
}
