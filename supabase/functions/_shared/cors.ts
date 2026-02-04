// Shared utilities for Edge Functions

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://meal-planning-virid.vercel.app',
  'https://meal-planning-adrianstiers-projects.vercel.app',
  'https://meal-planning-git-main-adrianstiers-projects.vercel.app',
  // New client project domain
  'https://client-six-inky.vercel.app',
];

// Also allow origins from environment variable (comma-separated)
const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
if (envOrigins) {
  ALLOWED_ORIGINS.push(...envOrigins.split(',').map(o => o.trim()));
}

// Pattern to match Vercel preview deployments for both meal-planning and client projects
const VERCEL_PREVIEW_PATTERN = /^https:\/\/(meal-planning|client)-[a-z0-9]+-adrian-stiers-projects(-807dad27)?\.vercel\.app$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = isAllowedOrigin(requestOrigin) ? requestOrigin! : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '3600',
  };
}

export function handleCorsPrelight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) });
  }
  return null;
}

// Input validation
export const MAX_RECIPE_TEXT_LENGTH = 100000;
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
  return text.trim().slice(0, maxLength);
}

// JWT validation
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

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { authenticated: false, error: 'Invalid authorization format' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return { authenticated: false, error: 'Service configuration error' };
  }

  try {
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
    if (!user?.id) {
      return { authenticated: false, error: 'Invalid user data' };
    }

    return { authenticated: true, userId: user.id };
  } catch {
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// Simple in-memory rate limiting
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup tracking to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Clean every minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export function checkRateLimitSync(userId: string, maxRequests = 20, windowMs = 60000): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent memory leaks
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries that are older than 2x the window (definitely expired)
      if (now - entry.windowStart > windowMs * 2) {
        rateLimitStore.delete(key);
      }
    }
  }

  const key = `ratelimit:${userId}`;

  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 1, windowStart: now };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: windowMs - (now - entry.windowStart) };
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: windowMs - (now - entry.windowStart) };
}

export function rateLimitExceededResponse(corsHeaders: Record<string, string>, resetIn: number): Response {
  const resetInSeconds = Math.ceil(resetIn / 1000);
  return new Response(
    JSON.stringify({ error: `Rate limit exceeded. Please wait ${resetInSeconds} seconds.`, retryAfter: resetInSeconds }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(resetInSeconds) } }
  );
}

// Logging
export function log(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...data }));
}

export function logError(data: Record<string, unknown>): void {
  const errorMessage = data.error instanceof Error ? data.error.message : String(data.error);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...data, error: errorMessage }));
}

// Response helpers
export function jsonResponse(data: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, corsHeaders: Record<string, string>, status = 400, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// SSRF protection - validate that URLs point to public internet resources
export function isPublicUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    // Block private IP ranges and internal hostnames
    const blockedPatterns = [
      /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
      /^169\.254\./, // AWS metadata
      /^0\./, /^localhost$/i, /\.local$/i, /\.internal$/i,
      /^fc00:/, /^fe80:/, /^::1$/,  // IPv6 private
    ];
    return !blockedPatterns.some(pattern => pattern.test(hostname));
  } catch {
    return false;
  }
}

// CSRF protection - require XMLHttpRequest header
export function requireCsrfHeader(req: Request): boolean {
  return req.headers.get('X-Requested-With') === 'XMLHttpRequest';
}

// Anthropic API error handling
export interface AnthropicErrorResult {
  userMessage: string;
  statusCode: number;
}

export function handleAnthropicError(response: Response, errorData: { error?: { type?: string; message?: string } }): AnthropicErrorResult {
  const errorType = errorData?.error?.type;
  const errorMessage = errorData?.error?.message || 'Unknown error';

  switch (response.status) {
    case 400:
      return {
        userMessage: 'Invalid request to AI service. Please try again.',
        statusCode: 400,
      };
    case 401:
      return {
        userMessage: 'AI service authentication failed. Please contact support.',
        statusCode: 500,
      };
    case 403:
      return {
        userMessage: 'AI service access denied. Please contact support.',
        statusCode: 500,
      };
    case 429:
      return {
        userMessage: 'AI service is busy. Please try again in a few moments.',
        statusCode: 429,
      };
    case 500:
    case 502:
    case 503:
      return {
        userMessage: 'AI service is temporarily unavailable. Please try again.',
        statusCode: 503,
      };
    default:
      // Log the actual error for debugging
      console.error('Anthropic API error:', { status: response.status, type: errorType, message: errorMessage });
      return {
        userMessage: 'Failed to process with AI. Please try again.',
        statusCode: response.status >= 500 ? 503 : 400,
      };
  }
}
