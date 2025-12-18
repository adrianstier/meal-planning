import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Debug logging for credentials
console.log('[Supabase] URL configured:', !!supabaseUrl, supabaseUrl ? `(${supabaseUrl.substring(0, 30)}...)` : '(empty)');
console.log('[Supabase] Anon key configured:', !!supabaseAnonKey, supabaseAnonKey ? `(${supabaseAnonKey.length} chars)` : '(empty)');

// Check for missing credentials
export const isMissingCredentials = !supabaseUrl || !supabaseAnonKey;

if (isMissingCredentials) {
  console.error(
    '[Supabase] Missing environment variables. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment or .env.local file.'
  );
} else {
  console.log('[Supabase] Credentials present, initializing client...');
}

// Create client even with empty strings to prevent crashes, but it won't work
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;
