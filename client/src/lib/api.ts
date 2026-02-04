import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { errorLogger } from '../utils/errorLogger';
import { rateLimiters, checkRateLimit } from '../utils/rateLimiter';
import type {
  Meal,
  MealPlan,
  Leftover,
  SchoolMenuItem,
  MenuFeedback,
  LunchAlternative,
  CalendarData,
  ShoppingItem,
  MealHistory,
  PlanConstraints,
  LeftoverSuggestion,
  Restaurant,
  RestaurantFilters,
  BentoItem,
  BentoPlan,
} from '../types/api';

// ============================================================================
// TYPES FOR INTERNAL USE
// ============================================================================

interface ScheduledMealUpdate {
  meal_id?: number;
  meal_type?: string;
  notes?: string;
  servings?: number;
  meal_date?: string;
  day_of_week?: string;
}

interface GeneratedMealPlanItem {
  meal_id: number;
  date: string;
  meal_type: string;
  meal_name?: string;
}

// ============================================================================
// DATE UTILITIES (Timezone-safe)
// ============================================================================

/**
 * Convert a Date to YYYY-MM-DD string in local timezone.
 * This avoids the timezone issues with toISOString().split('T')[0]
 * which uses UTC and can return the wrong date near midnight.
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 */
function getTodayString(): string {
  return toLocalDateString(new Date());
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

const EDGE_FUNCTION_TIMEOUT = 90000; // 90 seconds for AI operations (some sites are slow to fetch)

// Direct fetch for Edge Functions - more reliable than Supabase client for long-running operations
// The Supabase client's internal fetch handling can have issues with timeouts and CORS in some browsers
// Development-only logging helper
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };
const devError = (...args: unknown[]) => { if (isDev) console.error(...args); };

async function directEdgeFunctionFetch<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT
): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  devLog(`[directEdgeFunctionFetch] Starting call to ${functionName}`);

  if (!supabaseUrl || !supabaseAnonKey) {
    devError('[directEdgeFunctionFetch] Missing Supabase configuration');
    return { data: null, error: new Error('Missing Supabase configuration') };
  }

  // Get the current session for auth - try multiple methods for browser compatibility
  devLog('[directEdgeFunctionFetch] Getting session...');
  let accessToken: string | undefined;

  try {
    // First try getSession (fastest, cached)
    const { data: sessionData } = await supabase.auth.getSession();
    accessToken = sessionData?.session?.access_token;

    // If no token from getSession, try getUser which forces a refresh
    if (!accessToken) {
      devLog('[directEdgeFunctionFetch] No token from getSession, trying getUser...');
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // If user exists, try to get session again
        const { data: refreshedSession } = await supabase.auth.getSession();
        accessToken = refreshedSession?.session?.access_token;
      }
    }
  } catch (authError) {
    devError('[directEdgeFunctionFetch] Auth error:', authError);
  }

  if (!accessToken) {
    devError('[directEdgeFunctionFetch] Not authenticated - no access token');
    return { data: null, error: new Error('Not authenticated. Please log in again.') };
  }
  devLog('[directEdgeFunctionFetch] Got access token, making fetch request...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    devLog(`[directEdgeFunctionFetch] Timeout triggered after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const url = `${supabaseUrl}/functions/v1/${functionName}`;
    devLog(`[directEdgeFunctionFetch] Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // Explicitly omit credentials to avoid browser ITP/cookie issues
      credentials: 'omit',
    });

    clearTimeout(timeoutId);
    devLog(`[directEdgeFunctionFetch] Response received: status=${response.status}, ok=${response.ok}`);

    if (!response.ok) {
      const errorText = await response.text();
      devError(`[directEdgeFunctionFetch] Error response: ${errorText}`);
      let errorMessage = `Edge function error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      return { data: null, error: new Error(errorMessage) };
    }

    devLog('[directEdgeFunctionFetch] Parsing JSON response...');
    const data = await response.json();
    devLog('[directEdgeFunctionFetch] JSON parsed successfully:', typeof data, data ? Object.keys(data).slice(0, 5) : 'null');

    // Check if data contains an error
    if (data && typeof data === 'object' && 'error' in data && !('name' in data)) {
      devError('[directEdgeFunctionFetch] Data contains error:', data.error);
      return { data: null, error: new Error(data.error) };
    }

    devLog('[directEdgeFunctionFetch] Returning successful response');
    return { data: data as T, error: null };
  } catch (error) {
    clearTimeout(timeoutId);
    devError('[directEdgeFunctionFetch] Caught error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      devError('[directEdgeFunctionFetch] Request was aborted (timeout)');
      return { data: null, error: new Error(`Request timeout after ${timeoutMs / 1000}s`) };
    }
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateMealInput(meal: Partial<Meal>): ValidationResult {
  if (meal.name !== undefined) {
    if (!meal.name.trim()) return { valid: false, error: 'Meal name is required' };
    if (meal.name.length > 255) return { valid: false, error: 'Meal name too long (max 255 characters)' };
  }
  if (meal.servings !== undefined) {
    if (meal.servings < 1 || meal.servings > 999) return { valid: false, error: 'Servings must be between 1 and 999' };
  }
  if (meal.cook_time_minutes !== undefined && meal.cook_time_minutes < 0) {
    return { valid: false, error: 'Cook time cannot be negative' };
  }
  if (meal.leftover_servings !== undefined && meal.leftover_servings < 0) {
    return { valid: false, error: 'Leftover servings cannot be negative' };
  }
  if (meal.leftover_days !== undefined && meal.leftover_days < 0) {
    return { valid: false, error: 'Leftover days cannot be negative' };
  }
  if (meal.kid_rating !== undefined) {
    if (meal.kid_rating < 1 || meal.kid_rating > 10) {
      return { valid: false, error: 'Kid rating must be between 1 and 10' };
    }
  }
  return { valid: true };
}

function validateUrl(url: string): ValidationResult {
  if (!url || url.length > 2048) return { valid: false, error: 'Invalid URL' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use http or https' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function validateRecipeText(text: string): ValidationResult {
  if (!text || !text.trim()) return { valid: false, error: 'Recipe text is required' };
  if (text.length > 100000) return { valid: false, error: 'Recipe text too long (max 100KB)' };
  return { valid: true };
}

// ============================================================================
// TIMEOUT WRAPPER FOR EDGE FUNCTIONS
// ============================================================================

interface EdgeFunctionError extends Error {
  status?: number;
  responseBody?: Record<string, unknown>;
}

async function invokeWithTimeout<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT
): Promise<{ data: T; error: null } | { data: null; error: EdgeFunctionError }> {
  // Use direct fetch for all browsers - more reliable than Supabase client for long-running operations
  // This avoids issues with the Supabase client's internal fetch handling and browser-specific quirks
  devLog(`[API] Calling Edge Function: ${functionName}`);
  const result = await directEdgeFunctionFetch<T>(functionName, body, timeoutMs);
  if (result.error) {
    const edgeError: EdgeFunctionError = result.error;
    return { data: null, error: edgeError };
  }
  return { data: result.data, error: null };

}

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// Helper to wrap responses in expected format
const wrapResponse = <T>(data: T) => ({ data });

// Pagination response type
interface PaginatedResponse<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

// Default pagination limits
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// ============================================================================
// ERROR SANITIZATION UTILITIES
// ============================================================================

/**
 * User-friendly error messages mapped from common error patterns.
 * Keeps internal details hidden from clients while providing actionable messages.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'not authenticated': 'Please log in to continue.',
  'jwt expired': 'Your session has expired. Please log in again.',
  'invalid token': 'Your session is invalid. Please log in again.',
  // Database errors
  'violates foreign key constraint': 'This item is referenced by other data and cannot be modified.',
  'violates unique constraint': 'This item already exists.',
  'violates check constraint': 'The provided data is invalid.',
  'row-level security': 'You do not have permission to perform this action.',
  // Network errors
  'network error': 'Unable to connect to the server. Please check your internet connection.',
  'failed to fetch': 'Unable to connect to the server. Please check your internet connection.',
  'timeout': 'The request took too long. Please try again.',
  'aborted': 'The request was cancelled.',
  // Rate limiting
  'rate limit': 'Too many requests. Please wait a moment and try again.',
};

/**
 * Sanitize error messages for client consumption.
 * Hides stack traces, internal details, and database-specific information.
 */
function sanitizeErrorMessage(error: unknown, fallbackMessage: string = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallbackMessage;

  let rawMessage = '';

  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    rawMessage = (errorObj.message as string) || (errorObj.error as string) || '';
  }

  const lowerMessage = rawMessage.toLowerCase();

  // Check for known error patterns and return user-friendly message
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_MESSAGES)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // Filter out technical details like stack traces, SQL details, etc.
  // If message looks technical (contains code patterns), return generic message
  if (
    (rawMessage.includes('at ') && rawMessage.includes('(')) || // Stack trace pattern
    rawMessage.includes('SELECT ') || rawMessage.includes('INSERT ') || // SQL
    rawMessage.includes('supabase') || // Internal service names
    rawMessage.includes('postgres') ||
    rawMessage.includes('PGRST') || // PostgREST error codes
    rawMessage.length > 200 // Very long messages are likely technical
  ) {
    return fallbackMessage;
  }

  // Return the original message if it appears safe (short, no technical details)
  return rawMessage || fallbackMessage;
}

/**
 * Create a sanitized error to throw to the client.
 * Logs the original error internally but returns a safe error to the user.
 */
function createSanitizedError(originalError: unknown, endpoint: string, method: string, fallbackMessage: string): Error {
  // Log the full error internally for debugging
  errorLogger.logApiError(
    originalError instanceof Error ? originalError : new Error(String(originalError)),
    endpoint,
    method
  );

  // Return sanitized error for client
  const sanitizedMessage = sanitizeErrorMessage(originalError, fallbackMessage);
  return new Error(sanitizedMessage);
}

// ============================================================================
// DATA TRANSFORM UTILITIES
// ============================================================================

/**
 * Transform scheduled meal data from database format to MealPlan format.
 * Used by planApi.getWeek, planApi.add, and planApi.update.
 */
function transformScheduledMealToMealPlan(item: {
  id: number;
  meal_date: string;
  meal_type: string;
  meal_id: number;
  notes?: string;
  servings?: number;
  meal?: {
    name?: string;
    cook_time_minutes?: number;
    difficulty?: string;
    tags?: string;
    ingredients?: string;
    instructions?: string;
    cuisine?: string;
    image_url?: string;
  } | null;
}): MealPlan {
  return {
    id: item.id,
    plan_date: item.meal_date,
    meal_type: item.meal_type,
    meal_id: item.meal_id,
    meal_name: item.meal?.name,
    notes: item.notes,
    servings: item.servings,
    cook_time_minutes: item.meal?.cook_time_minutes,
    difficulty: item.meal?.difficulty,
    tags: item.meal?.tags,
    meal_tags: item.meal?.tags,
    ingredients: item.meal?.ingredients,
    instructions: item.meal?.instructions,
    cuisine: item.meal?.cuisine,
    image_url: item.meal?.image_url,
  } as MealPlan;
}

/**
 * Transform leftover inventory data from database format to Leftover format.
 * Calculates days_until_expiry dynamically.
 */
function transformLeftoverInventory(item: {
  id: number;
  meal_id: number;
  meal_name?: string;
  cooked_date: string;
  servings_remaining: number;
  expires_date: string;
  notes?: string;
  created_at?: string;
  meal?: { name?: string } | null;
}): Leftover {
  return {
    id: item.id,
    meal_id: item.meal_id,
    meal_name: item.meal?.name || item.meal_name,
    cooked_date: item.cooked_date,
    servings_remaining: item.servings_remaining,
    expires_date: item.expires_date,
    days_until_expiry: Math.ceil(
      (new Date(item.expires_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
    notes: item.notes,
    created_at: item.created_at,
  } as Leftover;
}

/**
 * Transform meal history data from database format to MealHistory format.
 */
function transformMealHistory(item: {
  id: number;
  meal_id: number;
  cooked_date: string;
  rating?: number;
  notes?: string;
  meal?: { name?: string } | null;
}): MealHistory {
  return {
    id: item.id,
    meal_id: item.meal_id,
    meal_name: item.meal?.name,
    cooked_date: item.cooked_date,
    rating: item.rating,
    notes: item.notes,
  } as MealHistory;
}

/**
 * Transform bento plan data from database format to BentoPlan format.
 */
function transformBentoPlan(item: {
  id: number;
  plan_date: string;
  child_name?: string;
  notes?: string;
  compartment1?: BentoItem | null;
  compartment2?: BentoItem | null;
  compartment3?: BentoItem | null;
  compartment4?: BentoItem | null;
}): BentoPlan {
  return {
    id: item.id,
    date: item.plan_date,
    child_name: item.child_name,
    compartment1: item.compartment1 || undefined,
    compartment2: item.compartment2 || undefined,
    compartment3: item.compartment3 || undefined,
    compartment4: item.compartment4 || undefined,
    notes: item.notes,
  } as BentoPlan;
}

// ============================================================================
// MEALS API
// ============================================================================

export const mealsApi = {
  getAll: async (options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from('meals')
      .select('*', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) {
      throw createSanitizedError(error, '/meals', 'GET', 'Failed to load recipes. Please try again.');
    }

    // Return paginated response if pagination was requested
    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: data as Meal[],
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<Meal>;
    }

    // Return simple response for backwards compatibility
    return wrapResponse(data as Meal[]);
  },

  getById: async (id: number) => {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw createSanitizedError(error, `/meals/${id}`, 'GET', 'Failed to load recipe. Please try again.');
    }
    return wrapResponse(data as Meal);
  },

  create: async (meal: Partial<Meal>) => {
    // Validate input
    const validation = validateMealInput(meal);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const userId = await getCurrentUserId();

    // Sanitize input
    const sanitizedMeal = {
      ...meal,
      name: meal.name?.trim(),
      user_id: userId,
    };

    const { data, error } = await supabase
      .from('meals')
      .insert(sanitizedMeal)
      .select()
      .single();

    if (error) {
      throw createSanitizedError(error, '/meals', 'POST', 'Failed to create recipe. Please try again.');
    }
    return wrapResponse(data as Meal);
  },

  update: async (id: number, meal: Partial<Meal>) => {
    // Validate input
    const validation = validateMealInput(meal);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const userId = await getCurrentUserId();

    const sanitizedMeal = {
      ...meal,
      name: meal.name?.trim(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('meals')
      .update(sanitizedMeal)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw createSanitizedError(error, `/meals/${id}`, 'PUT', 'Failed to update recipe. Please try again.');
    }
    return wrapResponse(data as Meal);
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw createSanitizedError(error, `/meals/${id}`, 'DELETE', 'Failed to delete recipe. Please try again.');
    }
    return wrapResponse({ success: true });
  },

  bulkDelete: async (mealIds: number[]) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('meals')
      .delete()
      .in('id', mealIds)
      .eq('user_id', userId);

    if (error) {
      throw createSanitizedError(error, '/meals/bulk-delete', 'POST', 'Failed to delete recipes. Please try again.');
    }
    return wrapResponse({ deleted_count: mealIds.length });
  },

  parseRecipe: async (text: string) => {
    // Validate input
    const validation = validateRecipeText(text);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check client-side rate limit before calling AI
    checkRateLimit(rateLimiters.aiParsing, 'parseRecipe', 'AI parsing limit reached.');

    // Call Edge Function for AI parsing with timeout
    const { data, error } = await invokeWithTimeout<Meal>('parse-recipe', {
      recipe_text: text.trim(),
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe', 'POST');

      // Extract error message from response body if available
      const edgeError = error as EdgeFunctionError;
      const errorMessage = edgeError.responseBody?.error as string || error.message || 'Failed to parse recipe. Please try again.';
      throw new Error(errorMessage);
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromImage: async (imageFile: File) => {
    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (imageFile.size > MAX_FILE_SIZE) {
      throw new Error('Image too large. Maximum size is 10MB.');
    }

    // Validate file type by MIME type first
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please upload an image.');
    }

    // Validate file signature (magic bytes) for security
    const validImageSignatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, followed by WEBP
      'image/heic': [[0x00, 0x00, 0x00]], // ftyp box (varies)
      'image/heif': [[0x00, 0x00, 0x00]], // ftyp box (varies)
    };

    // Read first 12 bytes to check magic bytes
    const headerBuffer = await imageFile.slice(0, 12).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);

    const signatures = validImageSignatures[imageFile.type];
    if (signatures) {
      const isValidSignature = signatures.some(sig =>
        sig.every((byte, i) => headerBytes[i] === byte)
      );
      if (!isValidSignature) {
        throw new Error('File content does not match image type. Please upload a valid image.');
      }
    }

    // Check client-side rate limit before calling AI
    checkRateLimit(rateLimiters.aiParsing, 'parseRecipeFromImage', 'AI parsing limit reached.');

    // Convert file to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const { data, error } = await invokeWithTimeout<Meal>('parse-recipe-image', {
      image_data: base64,
      image_type: imageFile.type,
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-image', 'POST');

      // Extract error message from response body if available
      const edgeError = error as EdgeFunctionError;
      const errorMessage = edgeError.responseBody?.error as string || error.message || 'Failed to parse recipe from image. Please try again.';
      throw new Error(errorMessage);
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromUrl: async (url: string) => {
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { data, error } = await invokeWithTimeout<Meal>('parse-recipe-url', { url });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-url', 'POST');

      // Check if the error response indicates AI parsing is needed
      const edgeError = error as EdgeFunctionError;

      // Log for debugging (dev only)
      devLog('[parseRecipeFromUrl] Error response:', {
        message: error.message,
        status: edgeError.status,
        responseBody: edgeError.responseBody,
        needsAI: edgeError.responseBody?.needsAI,
      });

      if (edgeError.responseBody?.needsAI) {
        // Create an error that preserves the needsAI flag for the UI to detect
        const aiError: EdgeFunctionError = new Error(
          edgeError.responseBody?.message as string ||
          'No structured recipe data found. Try AI Enhanced parsing.'
        );
        aiError.responseBody = edgeError.responseBody;
        throw aiError;
      }

      // For other errors, use the message from the response if available
      const errorMessage = edgeError.responseBody?.error as string ||
        error.message ||
        'Failed to parse recipe from URL. Please check the URL and try again.';
      throw new Error(errorMessage);
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromUrlAI: async (url: string) => {
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check client-side rate limit before calling AI
    checkRateLimit(rateLimiters.aiParsing, 'parseRecipeFromUrlAI', 'AI parsing limit reached.');

    const { data, error } = await invokeWithTimeout<Meal>('parse-recipe-url-ai', { url });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-url-ai', 'POST');

      // Extract error message from response body if available
      const edgeError = error as EdgeFunctionError;
      const errorMessage = edgeError.responseBody?.error as string || error.message || 'Failed to parse recipe from URL. Please check the URL and try again.';
      throw new Error(errorMessage);
    }
    return wrapResponse(data as Meal);
  },

  search: async (query: string) => {
    // Validate and sanitize search query to prevent injection
    if (!query || typeof query !== 'string') {
      return wrapResponse([] as Meal[]);
    }

    // Limit query length to prevent abuse
    const trimmedQuery = query.trim().slice(0, 100);
    if (!trimmedQuery) {
      return wrapResponse([] as Meal[]);
    }

    // Escape SQL LIKE wildcards to prevent pattern injection
    let sanitizedQuery = trimmedQuery
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent signs
      .replace(/_/g, '\\_');   // Escape underscores

    // Escape PostgREST special characters to prevent operator injection
    // These characters have special meaning in PostgREST filter syntax
    sanitizedQuery = sanitizedQuery
      .replace(/,/g, '\\,')    // Escape commas (filter separator)
      .replace(/\./g, '\\.')   // Escape dots (operator separator)
      .replace(/\(/g, '\\(')   // Escape open parens (grouping)
      .replace(/\)/g, '\\)')   // Escape close parens (grouping)
      .replace(/:/g, '\\:')    // Escape colons (modifier separator)
      .replace(/"/g, '\\"')    // Escape quotes (value delimiter)
      .replace(/\*/g, '\\*')   // Escape asterisks (wildcards)
      .replace(/\|/g, '\\|');  // Escape pipes (OR operator in .or())

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .or(`name.ilike.%${sanitizedQuery}%,ingredients.ilike.%${sanitizedQuery}%,tags.ilike.%${sanitizedQuery}%`)
      .order('name');

    if (error) {
      errorLogger.logApiError(error, '/meals/search', 'GET');
      throw error;
    }
    return wrapResponse(data as Meal[]);
  },

  favorite: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('meals')
      .update({ is_favorite: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}/favorite`, 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  unfavorite: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('meals')
      .update({ is_favorite: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}/favorite`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  updateLeftoverSettings: async (id: number, settings: { makes_leftovers: boolean; leftover_servings?: number; leftover_days?: number }) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('meals')
      .update(settings)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}/leftover-settings`, 'PUT');
      throw error;
    }
    return wrapResponse(data);
  },
};

// ============================================================================
// MEAL PLAN API
// ============================================================================

export const planApi = {
  getWeek: async (startDate: string) => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const { data, error } = await supabase
      .from('scheduled_meals')
      .select(`
        *,
        meal:meals(*)
      `)
      .gte('meal_date', startDate)
      .lte('meal_date', toLocalDateString(endDate))
      .order('meal_date');

    if (error) {
      throw createSanitizedError(error, '/plan/week', 'GET', 'Failed to load meal plan. Please try again.');
    }

    // Transform using utility function
    const transformed = data?.map(transformScheduledMealToMealPlan) || [];

    return wrapResponse(transformed);
  },

  add: async (plan: Partial<MealPlan>) => {
    const userId = await getCurrentUserId();
    const planDate = plan.plan_date || getTodayString();

    const { data, error } = await supabase
      .from('scheduled_meals')
      .insert({
        user_id: userId,
        meal_id: plan.meal_id,
        meal_date: planDate,
        meal_type: plan.meal_type,
        day_of_week: new Date(planDate).toLocaleDateString('en-US', { weekday: 'long' }),
        notes: plan.notes,
        servings: plan.servings || 4,
      })
      .select(`
        *,
        meal:meals(*)
      `)
      .single();

    if (error) {
      throw createSanitizedError(error, '/plan', 'POST', 'Failed to add meal to plan. Please try again.');
    }

    return wrapResponse(transformScheduledMealToMealPlan(data));
  },

  update: async (id: number, plan: Partial<MealPlan>) => {
    const userId = await getCurrentUserId();

    const updateData: ScheduledMealUpdate = {};
    if (plan.meal_id !== undefined) updateData.meal_id = plan.meal_id;
    if (plan.meal_type !== undefined) updateData.meal_type = plan.meal_type;
    if (plan.notes !== undefined) updateData.notes = plan.notes;
    if (plan.servings !== undefined) updateData.servings = plan.servings;
    if (plan.plan_date !== undefined) {
      updateData.meal_date = plan.plan_date;
      updateData.day_of_week = new Date(plan.plan_date).toLocaleDateString('en-US', { weekday: 'long' });
    }

    const { data, error } = await supabase
      .from('scheduled_meals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        meal:meals(*)
      `)
      .single();

    if (error) {
      throw createSanitizedError(error, `/plan/${id}`, 'PUT', 'Failed to update meal plan. Please try again.');
    }

    const transformed = transformScheduledMealToMealPlan(data);

    return wrapResponse(transformed);
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('scheduled_meals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/plan/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  clearWeek: async (startDate: string) => {
    const userId = await getCurrentUserId();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const { error } = await supabase
      .from('scheduled_meals')
      .delete()
      .eq('user_id', userId)
      .gte('meal_date', startDate)
      .lte('meal_date', toLocalDateString(endDate));

    if (error) {
      errorLogger.logApiError(error, '/plan/clear-week', 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  suggest: async (date: string, mealType: string, constraints?: PlanConstraints) => {
    // Call Edge Function for AI suggestions with timeout handling
    const { data, error } = await invokeWithTimeout<Meal[]>('suggest-meal', {
      date, meal_type: mealType, ...constraints,
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/suggest-meal', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal[]);
  },

  generateWeek: async (
    startDate: string,
    numDays: number = 7,
    mealTypes: string[] = ['dinner'],
    avoidSchoolDuplicates?: boolean,
    cuisines?: string[] | 'all',
    _generateBentos?: boolean,
    _bentoChildName?: string
  ) => {
    const userId = await getCurrentUserId();

    // Fetch user's meals filtered by meal type and optionally cuisine
    let query = supabase
      .from('meals')
      .select('id, name, meal_type, cuisine')
      .eq('user_id', userId);

    // Filter by meal types
    if (mealTypes.length > 0) {
      query = query.in('meal_type', mealTypes);
    }

    // Filter by cuisines if specified
    if (cuisines && cuisines !== 'all' && Array.isArray(cuisines) && cuisines.length > 0) {
      query = query.in('cuisine', cuisines);
    }

    const { data: meals, error } = await query;

    if (error) {
      errorLogger.logApiError(error, '/plan/generate-week', 'POST');
      throw error;
    }

    if (!meals || meals.length === 0) {
      const cuisineFilter = cuisines && cuisines !== 'all' && Array.isArray(cuisines) && cuisines.length > 0
        ? ` with cuisine "${cuisines.join(', ')}"`
        : '';
      throw new Error(`No ${mealTypes.join('/')} recipes found${cuisineFilter}. Add some recipes first!`);
    }

    if (meals.length < numDays) {
      throw new Error(
        `You only have ${meals.length} ${mealTypes.join('/')} recipe${meals.length === 1 ? '' : 's'}, ` +
        `but need at least ${numDays} for a full week. Add more recipes or we'll repeat some.`
      );
    }

    // Shuffle meals randomly
    const shuffled = [...meals].sort(() => Math.random() - 0.5);

    // Generate plan for each day
    const generatedPlan: GeneratedMealPlanItem[] = [];
    const startDateObj = new Date(startDate);

    for (let i = 0; i < numDays; i++) {
      const currentDate = new Date(startDateObj);
      currentDate.setDate(startDateObj.getDate() + i);
      const dateStr = toLocalDateString(currentDate);

      // Pick a meal (cycle through if we don't have enough)
      const meal = shuffled[i % shuffled.length];

      for (const mealType of mealTypes) {
        generatedPlan.push({
          meal_id: meal.id,
          date: dateStr,
          meal_type: mealType,
          meal_name: meal.name,
        });
      }
    }

    return wrapResponse(generatedPlan);
  },

  applyGenerated: async (plan: GeneratedMealPlanItem[]) => {
    const userId = await getCurrentUserId();

    // Insert all scheduled meals
    const scheduledMeals = plan.map(item => ({
      user_id: userId,
      meal_id: item.meal_id,
      meal_date: item.date,
      meal_type: item.meal_type,
      day_of_week: new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' }),
    }));

    const { error } = await supabase
      .from('scheduled_meals')
      .insert(scheduledMeals);

    if (error) {
      errorLogger.logApiError(error, '/plan/apply-generated', 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },
};

// ============================================================================
// LEFTOVERS API
// ============================================================================

export const leftoversApi = {
  getActive: async () => {
    const { data, error } = await supabase
      .from('leftovers_inventory')
      .select('*, meal:meals(name)')
      .is('consumed_at', null)
      .order('expires_date');

    if (error) {
      throw createSanitizedError(error, '/leftovers', 'GET', 'Failed to load leftovers. Please try again.');
    }

    // Transform using utility function
    const transformed = data?.map(transformLeftoverInventory) || [];

    return wrapResponse(transformed);
  },

  add: async (leftover: { meal_id: number; cooked_date?: string; servings?: number; days_good?: number; notes?: string }) => {
    const userId = await getCurrentUserId();

    // Get meal name
    const { data: meal } = await supabase
      .from('meals')
      .select('name, leftover_days')
      .eq('id', leftover.meal_id)
      .single();

    const cookedDate = leftover.cooked_date || getTodayString();
    const daysGood = leftover.days_good || meal?.leftover_days || 3;
    const expiresDate = new Date(cookedDate);
    expiresDate.setDate(expiresDate.getDate() + daysGood);

    const { data, error } = await supabase
      .from('leftovers_inventory')
      .insert({
        user_id: userId,
        meal_id: leftover.meal_id,
        meal_name: meal?.name || 'Unknown',
        servings_remaining: leftover.servings || 4,
        cooked_date: cookedDate,
        expires_date: toLocalDateString(expiresDate),
        notes: leftover.notes,
      })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/leftovers', 'POST');
      throw error;
    }

    return wrapResponse({
      ...data,
      days_until_expiry: Math.ceil(
        (new Date(data.expires_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    } as Leftover);
  },

  consume: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('leftovers_inventory')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/leftovers/${id}/consume`, 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  updateServings: async (id: number, servings: number) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('leftovers_inventory')
      .update({ servings_remaining: servings })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/leftovers/${id}/servings`, 'PUT');
      throw error;
    }
    return wrapResponse(data);
  },

  getSuggestions: async () => {
    // First fetch active leftovers to pass to the AI
    const { data: leftovers, error: leftoverError } = await supabase
      .from('leftovers_inventory')
      .select('*, meal:meals(name)')
      .is('consumed_at', null)
      .order('expires_date');

    if (leftoverError) {
      errorLogger.logApiError(leftoverError, '/leftovers (for suggestions)', 'GET');
      throw leftoverError;
    }

    if (!leftovers || leftovers.length === 0) {
      // No leftovers, return empty suggestions array
      return wrapResponse([] as LeftoverSuggestion[]);
    }

    // Build a list of leftover ingredients/meals
    const leftoverIngredients = leftovers.map(item => {
      const mealName = item.meal?.name || item.meal_name || 'Unknown';
      const servings = item.servings_remaining || 1;
      return `${mealName} (${servings} servings)`;
    });

    // Get the most recent leftover as the "original meal" for context
    const originalMeal = leftovers[0]?.meal?.name || leftovers[0]?.meal_name;

    const { data, error } = await invokeWithTimeout<{ suggestions: LeftoverSuggestion[] }>('leftover-suggestions', {
      originalMeal,
      leftoverIngredients,
      availableTime: '30 minutes',
      servingsNeeded: 2,
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/leftover-suggestions', 'GET');
      throw error;
    }

    // Edge function returns { suggestions: [...] }, extract the array
    const suggestions = data?.suggestions || [];
    return wrapResponse(suggestions);
  },
};

// ============================================================================
// SCHOOL MENU API
// ============================================================================

export const schoolMenuApi = {
  getAll: async (options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from('school_menu_items')
      .select('*', { count: 'exact' })
      .order('menu_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      errorLogger.logApiError(error, '/school-menu', 'GET');
      throw error;
    }

    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: data as SchoolMenuItem[],
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<SchoolMenuItem>;
    }

    return wrapResponse(data as SchoolMenuItem[]);
  },

  getByDate: async (date: string) => {
    const { data, error } = await supabase
      .from('school_menu_items')
      .select('*')
      .eq('menu_date', date);

    if (error) {
      errorLogger.logApiError(error, `/school-menu?date=${date}`, 'GET');
      throw error;
    }
    return wrapResponse(data as SchoolMenuItem[]);
  },

  getRange: async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('school_menu_items')
      .select('*')
      .gte('menu_date', startDate)
      .lte('menu_date', endDate)
      .order('menu_date');

    if (error) {
      errorLogger.logApiError(error, '/school-menu/range', 'GET');
      throw error;
    }
    return wrapResponse(data as SchoolMenuItem[]);
  },

  add: async (item: Partial<SchoolMenuItem>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('school_menu_items')
      .insert({ ...item, user_id: userId })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/school-menu', 'POST');
      throw error;
    }
    return wrapResponse(data as SchoolMenuItem);
  },

  addBulk: async (items: Partial<SchoolMenuItem>[]) => {
    const userId = await getCurrentUserId();
    const itemsWithUser = items.map(item => ({ ...item, user_id: userId }));

    const { data, error } = await supabase
      .from('school_menu_items')
      .upsert(itemsWithUser, {
        onConflict: 'user_id,menu_date,meal_name,meal_type',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      errorLogger.logApiError(error, '/school-menu/bulk', 'POST');
      throw error;
    }
    return wrapResponse(data);
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('school_menu_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/school-menu/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  addFeedback: async (menuItemId: number, feedbackType: 'disliked' | 'allergic' | 'wont_eat', notes?: string) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('school_menu_feedback')
      .insert({
        user_id: userId,
        menu_item_id: menuItemId,
        feedback_type: feedbackType,
        notes,
      })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/school-menu/feedback', 'POST');
      throw error;
    }
    return wrapResponse(data as MenuFeedback);
  },

  getLunchAlternatives: async (date: string) => {
    const { data, error } = await invokeWithTimeout<LunchAlternative>('lunch-alternatives', { date });

    if (error) {
      errorLogger.logApiError(error, `/school-menu/lunch-alternatives/${date}`, 'GET');
      throw error;
    }
    return wrapResponse(data as LunchAlternative);
  },

  parsePhoto: async (imageData: string, imageType: string, autoAdd: boolean = false) => {
    // Edge function returns: { schoolName, weekOf, items: SchoolMenuItem[] }
    // Where SchoolMenuItem has: date, dayOfWeek, mainDish, sides, alternativeOptions, allergenInfo
    interface ParsedSchoolMenu {
      schoolName: string | null;
      weekOf: string | null;
      items: Array<{
        date: string;
        dayOfWeek: string;
        mainDish: string;
        sides: string[];
        alternativeOptions: string[];
        allergenInfo: string[];
      }>;
    }

    // Strip data URL prefix if present to get just the base64 data
    let base64Data = imageData;
    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:[^;]+;base64,(.+)$/);
      if (matches) {
        base64Data = matches[1];
      }
    }

    const { data, error } = await invokeWithTimeout<ParsedSchoolMenu>('parse-school-menu', {
      image_data: base64Data,
      image_type: imageType,
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-school-menu', 'POST');
      throw error;
    }

    // Transform the Edge Function response to the format expected by the frontend
    const parsedItems = data?.items || [];

    // Convert parsed items to SchoolMenuItem format for database storage
    const menuItems: Partial<SchoolMenuItem>[] = parsedItems.map(item => ({
      menu_date: item.date,
      meal_name: item.mainDish,
      meal_type: 'lunch' as const, // School menus are typically lunch
      description: [
        ...(item.sides || []),
        ...(item.alternativeOptions?.length ? [`Alt: ${item.alternativeOptions.join(', ')}`] : []),
        ...(item.allergenInfo?.length ? [`Allergens: ${item.allergenInfo.join(', ')}`] : []),
      ].filter(Boolean).join('; ') || undefined,
    }));

    // If autoAdd is true, save to database
    let addedCount = 0;
    if (autoAdd && menuItems.length > 0) {
      try {
        const userId = await getCurrentUserId();
        const itemsWithUser = menuItems.map(item => ({ ...item, user_id: userId }));

        const { error: insertError } = await supabase
          .from('school_menu_items')
          .upsert(itemsWithUser, {
            onConflict: 'user_id,menu_date,meal_name,meal_type',
            ignoreDuplicates: false,
          });

        if (insertError) {
          errorLogger.logApiError(insertError, '/school-menu/bulk', 'POST');
        } else {
          addedCount = menuItems.length;
        }
      } catch (addError) {
        // Log but don't fail - still return the parsed data
        errorLogger.logApiError(addError instanceof Error ? addError : new Error(String(addError)), '/school-menu/bulk', 'POST');
      }
    }

    return wrapResponse({
      success: true,
      menu_items: menuItems as SchoolMenuItem[],
      count: menuItems.length,
      added_count: addedCount,
    });
  },

  getCalendar: async (startDate?: string, endDate?: string) => {
    let query = supabase.from('school_menu_items').select('*');

    if (startDate) query = query.gte('menu_date', startDate);
    if (endDate) query = query.lte('menu_date', endDate);

    const { data, error } = await query.order('menu_date');

    if (error) {
      errorLogger.logApiError(error, '/school-menu/calendar', 'GET');
      throw error;
    }

    // Transform into calendar format
    const calendar: CalendarData = {};

    data?.forEach(item => {
      if (!calendar[item.menu_date]) {
        calendar[item.menu_date] = { breakfast: [], lunch: [], snack: [] };
      }
      const mealType = item.meal_type as 'breakfast' | 'lunch' | 'snack';
      calendar[item.menu_date][mealType].push(item as SchoolMenuItem);
    });

    return wrapResponse({ success: true, calendar_data: calendar });
  },

  cleanup: async (daysOld: number = 60) => {
    const userId = await getCurrentUserId();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from('school_menu_items')
      .delete()
      .eq('user_id', userId)
      .lt('menu_date', toLocalDateString(cutoffDate));

    if (error) {
      errorLogger.logApiError(error, '/school-menu/cleanup', 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },
};

// ============================================================================
// SHOPPING API
// ============================================================================

export const shoppingApi = {
  getAll: async (options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact' })
      .order('is_purchased')
      .order('category')
      .order('item_name')
      .range(offset, offset + limit - 1);

    if (error) {
      throw createSanitizedError(error, '/shopping', 'GET', 'Failed to load shopping list. Please try again.');
    }

    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: data as ShoppingItem[],
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<ShoppingItem>;
    }

    return wrapResponse(data as ShoppingItem[]);
  },

  add: async (item: Partial<ShoppingItem>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ ...item, user_id: userId })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/shopping', 'POST');
      throw error;
    }
    return wrapResponse(data as ShoppingItem);
  },

  update: async (id: number, item: Partial<ShoppingItem>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('shopping_items')
      .update(item)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/shopping/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as ShoppingItem);
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/shopping/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  togglePurchased: async (id: number) => {
    const userId = await getCurrentUserId();

    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('shopping_items')
      .select('is_purchased')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      errorLogger.logApiError(fetchError, `/shopping/${id}/toggle`, 'GET');
      throw fetchError;
    }

    const { data, error } = await supabase
      .from('shopping_items')
      .update({ is_purchased: !current?.is_purchased })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/shopping/${id}/toggle`, 'POST');
      throw error;
    }
    return wrapResponse(data as ShoppingItem);
  },

  clearPurchased: async () => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('user_id', userId)
      .eq('is_purchased', true);

    if (error) {
      errorLogger.logApiError(error, '/shopping/purchased', 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  clearAll: async () => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, '/shopping/all', 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  generateFromPlan: async (startDate: string, endDate: string) => {
    const userId = await getCurrentUserId();

    // Fetch meal plan items for the date range (using scheduled_meals table)
    const { data: planItems, error: planError } = await supabase
      .from('scheduled_meals')
      .select('meal_id, servings, meal:meals(ingredients)')
      .eq('user_id', userId)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate);

    if (planError) {
      errorLogger.logApiError(planError, '/shopping/generate', 'GET');
      throw planError;
    }

    if (!planItems || planItems.length === 0) {
      throw new Error('No meals planned for this date range. Add some meals to your plan first!');
    }

    // Extract and parse ingredients from all planned meals
    const ingredientMap = new Map<string, { quantity: string; category: string }>();

    for (const item of planItems) {
      // Type guard for the joined meal data
      const mealData = item.meal;
      if (!mealData || typeof mealData !== 'object' || !('ingredients' in mealData)) continue;
      const meal = mealData as { ingredients: string };
      if (!meal.ingredients || typeof meal.ingredients !== 'string') continue;

      // Parse ingredients (one per line)
      const lines = meal.ingredients.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const trimmed = line.trim().replace(/^[-•*]\s*/, ''); // Remove bullet points
        if (!trimmed) continue;

        // Try to extract quantity and item name
        // Supports: digits, common Unicode fractions (½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚), spaces, slashes, dots
        // Also handles mixed fractions like "1 1/2" or "1½"
        // The 'u' flag enables full Unicode support for ingredient names
        const match = trimmed.match(/^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s\/\.]+)?\s*(.+)$/u);
        const quantity = match?.[1]?.trim() || '';
        const name = match?.[2]?.trim().toLowerCase() || trimmed.toLowerCase();

        if (ingredientMap.has(name)) {
          // Item already exists, could aggregate quantities but for now just skip
          continue;
        }

        // Guess category based on common ingredients
        let category = 'Other';
        const lowerName = name.toLowerCase();
        if (/milk|cheese|yogurt|butter|cream|egg/i.test(lowerName)) category = 'Dairy';
        else if (/chicken|beef|pork|fish|salmon|shrimp|bacon|sausage/i.test(lowerName)) category = 'Meat & Seafood';
        else if (/apple|banana|orange|lemon|lime|berry|fruit/i.test(lowerName)) category = 'Fruits';
        else if (/lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|vegetable|broccoli|spinach/i.test(lowerName)) category = 'Vegetables';
        else if (/bread|flour|pasta|rice|cereal|oat/i.test(lowerName)) category = 'Grains & Bread';
        else if (/salt|pepper|spice|herb|oregano|basil|cumin|paprika/i.test(lowerName)) category = 'Spices';
        else if (/oil|vinegar|sauce|ketchup|mustard|mayo/i.test(lowerName)) category = 'Condiments';
        else if (/can|canned|broth|stock|tomato paste/i.test(lowerName)) category = 'Canned Goods';
        else if (/frozen/i.test(lowerName)) category = 'Frozen';

        ingredientMap.set(name, { quantity, category });
      }
    }

    if (ingredientMap.size === 0) {
      throw new Error('No ingredients found in the planned meals.');
    }

    // Insert shopping items (using item_name as per database schema)
    const shoppingItems = Array.from(ingredientMap.entries()).map(([name, { quantity, category }]) => ({
      user_id: userId,
      item_name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
      quantity: quantity || null,
      category,
      is_purchased: false,
    }));

    const { data: insertedItems, error: insertError } = await supabase
      .from('shopping_items')
      .insert(shoppingItems)
      .select();

    if (insertError) {
      errorLogger.logApiError(insertError, '/shopping/generate', 'POST');
      throw insertError;
    }

    return wrapResponse(insertedItems as ShoppingItem[]);
  },
};

// ============================================================================
// HISTORY API
// ============================================================================

export const historyApi = {
  getAll: async (options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from('meal_history')
      .select('*, meal:meals(name)', { count: 'exact' })
      .order('cooked_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw createSanitizedError(error, '/history', 'GET', 'Failed to load meal history. Please try again.');
    }

    // Transform using utility function
    const transformed = data?.map(transformMealHistory) || [];

    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: transformed,
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<MealHistory>;
    }

    return wrapResponse(transformed);
  },

  add: async (history: Partial<MealHistory>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('meal_history')
      .insert({
        user_id: userId,
        meal_id: history.meal_id,
        cooked_date: history.cooked_date || getTodayString(),
        rating: history.rating,
        notes: history.notes,
      })
      .select('*, meal:meals(name)')
      .single();

    if (error) {
      throw createSanitizedError(error, '/history', 'POST', 'Failed to add meal history. Please try again.');
    }

    return wrapResponse(transformMealHistory(data));
  },

  update: async (id: number, history: Partial<MealHistory>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('meal_history')
      .update({
        rating: history.rating,
        notes: history.notes,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, meal:meals(name)')
      .single();

    if (error) {
      throw createSanitizedError(error, `/history/${id}`, 'PUT', 'Failed to update meal history. Please try again.');
    }

    return wrapResponse(transformMealHistory(data));
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('meal_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/history/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  getByMeal: async (mealId: number) => {
    const { data, error } = await supabase
      .from('meal_history')
      .select('*')
      .eq('meal_id', mealId)
      .order('cooked_date', { ascending: false });

    if (error) {
      errorLogger.logApiError(error, `/history/meal/${mealId}`, 'GET');
      throw error;
    }
    return wrapResponse(data as MealHistory[]);
  },
};

// ============================================================================
// RESTAURANTS API
// ============================================================================

export const restaurantsApi = {
  getAll: async (filters?: RestaurantFilters, options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    let query = supabase.from('restaurants').select('*', { count: 'exact' });

    if (filters?.cuisine_type) {
      query = query.eq('cuisine_type', filters.cuisine_type);
    }
    if (filters?.outdoor_seating !== undefined) {
      query = query.eq('outdoor_seating', filters.outdoor_seating);
    }
    if (filters?.has_bar !== undefined) {
      query = query.eq('has_bar', filters.has_bar);
    }
    if (filters?.kid_friendly !== undefined) {
      query = query.eq('kid_friendly', filters.kid_friendly);
    }
    if (filters?.price_range) {
      query = query.eq('price_range', filters.price_range);
    }

    const { data, error, count } = await query
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) {
      throw createSanitizedError(error, '/restaurants', 'GET', 'Failed to load restaurants. Please try again.');
    }

    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: data as Restaurant[],
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<Restaurant>;
    }

    return wrapResponse(data as Restaurant[]);
  },

  getById: async (id: number) => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      errorLogger.logApiError(error, `/restaurants/${id}`, 'GET');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  create: async (restaurant: Partial<Restaurant>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('restaurants')
      .insert({ ...restaurant, user_id: userId })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/restaurants', 'POST');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  update: async (id: number, restaurant: Partial<Restaurant>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('restaurants')
      .update({ ...restaurant, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/restaurants/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  delete: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/restaurants/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  suggest: async (filters?: RestaurantFilters) => {
    const { data, error } = await invokeWithTimeout<Restaurant[]>('suggest-restaurant', { ...filters });

    if (error) {
      errorLogger.logApiError(error, '/functions/suggest-restaurant', 'POST');
      throw error;
    }
    return wrapResponse(data as Restaurant[]);
  },

  search: async (query: string) => {
    const { data, error } = await invokeWithTimeout<Partial<Restaurant>>('search-restaurant', { query });

    if (error) {
      errorLogger.logApiError(error, '/functions/search-restaurant', 'POST');
      throw error;
    }
    return wrapResponse(data as Partial<Restaurant>);
  },

  scrape: async (id: number) => {
    const { data, error } = await invokeWithTimeout<Restaurant>('scrape-restaurant', { restaurant_id: id });

    if (error) {
      errorLogger.logApiError(error, `/functions/scrape-restaurant/${id}`, 'POST');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  scrapeUrl: async (url: string) => {
    const { data, error } = await invokeWithTimeout<Partial<Restaurant>>('scrape-restaurant-url', { url });

    if (error) {
      errorLogger.logApiError(error, '/functions/scrape-restaurant-url', 'POST');
      throw error;
    }
    return wrapResponse(data as Partial<Restaurant>);
  },

  geocode: async (address: string) => {
    const { data, error } = await invokeWithTimeout<{ latitude: number; longitude: number; display_name: string }>('geocode-address', { address });

    if (error) {
      errorLogger.logApiError(error, '/functions/geocode-address', 'POST');
      throw error;
    }
    return wrapResponse(data as { latitude: number; longitude: number; display_name: string });
  },
};

// ============================================================================
// BENTO API
// ============================================================================

export const bentoApi = {
  getItems: async (options?: { limit?: number; offset?: number }) => {
    const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from('bento_items')
      .select('*', { count: 'exact' })
      .order('category')
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) {
      throw createSanitizedError(error, '/bento/items', 'GET', 'Failed to load bento items. Please try again.');
    }

    if (options?.limit !== undefined || options?.offset !== undefined) {
      return {
        data: data as BentoItem[],
        count: count || 0,
        hasMore: (count || 0) > offset + limit,
      } as PaginatedResponse<BentoItem>;
    }

    return wrapResponse(data as BentoItem[]);
  },

  createItem: async (item: Partial<BentoItem>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('bento_items')
      .insert({ ...item, user_id: userId })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/bento/items', 'POST');
      throw error;
    }
    return wrapResponse(data as BentoItem);
  },

  updateItem: async (id: number, item: Partial<BentoItem>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('bento_items')
      .update(item)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/bento/items/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as BentoItem);
  },

  deleteItem: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('bento_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/bento/items/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  getPlans: async (startDate?: string, endDate?: string) => {
    let query = supabase
      .from('bento_plans')
      .select(`
        *,
        compartment1:bento_items!compartment1_id(*),
        compartment2:bento_items!compartment2_id(*),
        compartment3:bento_items!compartment3_id(*),
        compartment4:bento_items!compartment4_id(*)
      `);

    if (startDate) query = query.gte('plan_date', startDate);
    if (endDate) query = query.lte('plan_date', endDate);

    const { data, error } = await query.order('plan_date');

    if (error) {
      throw createSanitizedError(error, '/bento/plans', 'GET', 'Failed to load bento plans. Please try again.');
    }

    // Transform using utility function
    const transformed = data?.map(transformBentoPlan) || [];

    return wrapResponse(transformed);
  },

  createPlan: async (plan: Partial<BentoPlan>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('bento_plans')
      .insert({
        user_id: userId,
        plan_date: plan.date,
        child_name: plan.child_name,
        compartment1_id: plan.compartment1?.id,
        compartment2_id: plan.compartment2?.id,
        compartment3_id: plan.compartment3?.id,
        compartment4_id: plan.compartment4?.id,
        notes: plan.notes,
      })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/bento/plans', 'POST');
      throw error;
    }
    return wrapResponse(data as BentoPlan);
  },

  updatePlan: async (id: number, plan: Partial<BentoPlan>) => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('bento_plans')
      .update({
        plan_date: plan.date,
        child_name: plan.child_name,
        compartment1_id: plan.compartment1?.id,
        compartment2_id: plan.compartment2?.id,
        compartment3_id: plan.compartment3?.id,
        compartment4_id: plan.compartment4?.id,
        notes: plan.notes,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/bento/plans/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as BentoPlan);
  },

  deletePlan: async (id: number) => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('bento_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      errorLogger.logApiError(error, `/bento/plans/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },
};

// Default export for backwards compatibility
export default {
  meals: mealsApi,
  plan: planApi,
  leftovers: leftoversApi,
  schoolMenu: schoolMenuApi,
  shopping: shoppingApi,
  history: historyApi,
  restaurants: restaurantsApi,
  bento: bentoApi,
};
