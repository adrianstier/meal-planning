import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Check for missing credentials
export const isMissingCredentials = !supabaseUrl || !supabaseAnonKey;

// Only log configuration status in development (no sensitive data)
if (process.env.NODE_ENV === 'development' && isMissingCredentials) {
  console.error(
    '[Supabase] Missing environment variables. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment or .env.local file.'
  );
}

// Validate URL format to prevent accidental requests to wrong domains
function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Must be HTTPS and look like a Supabase URL
    return parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.supabase.co') ||
       parsed.hostname.endsWith('.supabase.in') ||
       parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

// Create a safe client that won't accidentally send requests to wrong domains
function createSafeClient(): SupabaseClient {
  if (isMissingCredentials) {
    // Return a client that will fail gracefully
    // Using a non-existent but safe localhost URL
    return createClient('http://localhost:0', 'missing-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    console.error('[Supabase] Invalid Supabase URL format');
    return createClient('http://localhost:0', 'invalid-url', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Use sessionStorage for slightly better XSS protection
      // (tokens cleared when browser tab closes)
      // Uncomment the line below for higher security (worse UX):
      // storage: window.sessionStorage,
    },
  });
}

export const supabase: SupabaseClient = createSafeClient();

export default supabase;
