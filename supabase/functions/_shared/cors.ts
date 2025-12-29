// Shared utilities for Edge Functions

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://meal-planning-virid.vercel.app',
  'https://meal-planning-adrianstiers-projects.vercel.app',
  'https://meal-planning-git-main-adrianstiers-projects.vercel.app',
];

// Also allow origins from environment variable (comma-separated)
const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
if (envOrigins) {
  ALLOWED_ORIGINS.push(...envOrigins.split(',').map(o => o.trim()));
}

// Pattern to match Vercel preview deployments
const VERCEL_PREVIEW_PATTERN = /^https:\/\/meal-planning-[a-z0-9]+-adrianstiers-projects\.vercel\.app$/;

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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export function checkRateLimitSync(userId: string, maxRequests = 20, windowMs = 60000): RateLimitResult {
  const now = Date.now();
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
