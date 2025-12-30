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
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

const EDGE_FUNCTION_TIMEOUT = 90000; // 90 seconds for AI operations (some sites are slow to fetch)

// Direct fetch for Edge Functions - more reliable than Supabase client for long-running operations
// The Supabase client's internal fetch handling can have issues with timeouts and CORS in some browsers
async function directEdgeFunctionFetch<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT
): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  console.log(`[directEdgeFunctionFetch] Starting call to ${functionName}`);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[directEdgeFunctionFetch] Missing Supabase configuration');
    return { data: null, error: new Error('Missing Supabase configuration') };
  }

  // Get the current session for auth
  console.log('[directEdgeFunctionFetch] Getting session...');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    console.error('[directEdgeFunctionFetch] Not authenticated - no access token');
    return { data: null, error: new Error('Not authenticated') };
  }
  console.log('[directEdgeFunctionFetch] Got access token, making fetch request...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[directEdgeFunctionFetch] Timeout triggered after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const url = `${supabaseUrl}/functions/v1/${functionName}`;
    console.log(`[directEdgeFunctionFetch] Fetching: ${url}`);

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
    console.log(`[directEdgeFunctionFetch] Response received: status=${response.status}, ok=${response.ok}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[directEdgeFunctionFetch] Error response: ${errorText}`);
      let errorMessage = `Edge function error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      return { data: null, error: new Error(errorMessage) };
    }

    console.log('[directEdgeFunctionFetch] Parsing JSON response...');
    const data = await response.json();
    console.log('[directEdgeFunctionFetch] JSON parsed successfully:', typeof data, data ? Object.keys(data).slice(0, 5) : 'null');

    // Check if data contains an error
    if (data && typeof data === 'object' && 'error' in data && !('name' in data)) {
      console.error('[directEdgeFunctionFetch] Data contains error:', data.error);
      return { data: null, error: new Error(data.error) };
    }

    console.log('[directEdgeFunctionFetch] Returning successful response');
    return { data: data as T, error: null };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[directEdgeFunctionFetch] Caught error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[directEdgeFunctionFetch] Request was aborted (timeout)');
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
  console.log(`[API] Calling Edge Function: ${functionName}`);
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
      errorLogger.logApiError(error, '/meals', 'GET');
      throw error;
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
      errorLogger.logApiError(error, `/meals/${id}`, 'GET');
      throw error;
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
      errorLogger.logApiError(error, '/meals', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  update: async (id: number, meal: Partial<Meal>) => {
    // Validate input
    const validation = validateMealInput(meal);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const sanitizedMeal = {
      ...meal,
      name: meal.name?.trim(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('meals')
      .update(sanitizedMeal)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  delete: async (id: number) => {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  bulkDelete: async (mealIds: number[]) => {
    const { error } = await supabase
      .from('meals')
      .delete()
      .in('id', mealIds);

    if (error) {
      errorLogger.logApiError(error, '/meals/bulk-delete', 'POST');
      throw error;
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

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please upload an image.');
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

      // Log for debugging
      console.log('[parseRecipeFromUrl] Error response:', {
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
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .or(`name.ilike.%${query}%,ingredients.ilike.%${query}%,tags.ilike.%${query}%`)
      .order('name');

    if (error) {
      errorLogger.logApiError(error, '/meals/search', 'GET');
      throw error;
    }
    return wrapResponse(data as Meal[]);
  },

  favorite: async (id: number) => {
    const { error } = await supabase
      .from('meals')
      .update({ is_favorite: true })
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}/favorite`, 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  unfavorite: async (id: number) => {
    const { error } = await supabase
      .from('meals')
      .update({ is_favorite: false })
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/meals/${id}/favorite`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  updateLeftoverSettings: async (id: number, settings: { makes_leftovers: boolean; leftover_servings?: number; leftover_days?: number }) => {
    const { data, error } = await supabase
      .from('meals')
      .update(settings)
      .eq('id', id)
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
      .lte('meal_date', endDate.toISOString().split('T')[0])
      .order('meal_date');

    if (error) {
      errorLogger.logApiError(error, '/plan/week', 'GET');
      throw error;
    }

    // Transform to match existing format
    const transformed = data?.map(item => ({
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
    })) as MealPlan[];

    return wrapResponse(transformed);
  },

  add: async (plan: Partial<MealPlan>) => {
    const userId = await getCurrentUserId();
    const planDate = plan.plan_date || new Date().toISOString().split('T')[0];

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
      errorLogger.logApiError(error, '/plan', 'POST');
      throw error;
    }

    const transformed = {
      id: data.id,
      plan_date: data.meal_date,
      meal_type: data.meal_type,
      meal_id: data.meal_id,
      meal_name: data.meal?.name,
      notes: data.notes,
      servings: data.servings,
      cook_time_minutes: data.meal?.cook_time_minutes,
      difficulty: data.meal?.difficulty,
      tags: data.meal?.tags,
      ingredients: data.meal?.ingredients,
      instructions: data.meal?.instructions,
      cuisine: data.meal?.cuisine,
      image_url: data.meal?.image_url,
    } as MealPlan;

    return wrapResponse(transformed);
  },

  update: async (id: number, plan: Partial<MealPlan>) => {
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
      .select(`
        *,
        meal:meals(*)
      `)
      .single();

    if (error) {
      errorLogger.logApiError(error, `/plan/${id}`, 'PUT');
      throw error;
    }

    const transformed = {
      id: data.id,
      plan_date: data.meal_date,
      meal_type: data.meal_type,
      meal_id: data.meal_id,
      meal_name: data.meal?.name,
      notes: data.notes,
      servings: data.servings,
      cook_time_minutes: data.meal?.cook_time_minutes,
      difficulty: data.meal?.difficulty,
      tags: data.meal?.tags,
      ingredients: data.meal?.ingredients,
      instructions: data.meal?.instructions,
      cuisine: data.meal?.cuisine,
      image_url: data.meal?.image_url,
    } as MealPlan;

    return wrapResponse(transformed);
  },

  delete: async (id: number) => {
    const { error } = await supabase
      .from('scheduled_meals')
      .delete()
      .eq('id', id);

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
      .lte('meal_date', endDate.toISOString().split('T')[0]);

    if (error) {
      errorLogger.logApiError(error, '/plan/clear-week', 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  suggest: async (date: string, mealType: string, constraints?: PlanConstraints) => {
    // Call Edge Function for AI suggestions
    const { data, error } = await supabase.functions.invoke('suggest-meal', {
      body: { date, meal_type: mealType, ...constraints },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/suggest-meal', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal[]);
  },

  generateWeek: async (
    startDate: string,
    numDays?: number,
    mealTypes?: string[],
    avoidSchoolDuplicates?: boolean,
    cuisines?: string[] | 'all',
    generateBentos?: boolean,
    bentoChildName?: string
  ) => {
    const { data, error } = await supabase.functions.invoke('generate-week-plan', {
      body: {
        start_date: startDate,
        num_days: numDays,
        meal_types: mealTypes,
        avoid_school_duplicates: avoidSchoolDuplicates,
        cuisines: cuisines,
        generate_bentos: generateBentos,
        bento_child_name: bentoChildName,
      },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/generate-week-plan', 'POST');
      throw error;
    }
    return wrapResponse(data);
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
      errorLogger.logApiError(error, '/leftovers', 'GET');
      throw error;
    }

    const transformed = data?.map(item => ({
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
    })) as Leftover[];

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

    const cookedDate = leftover.cooked_date || new Date().toISOString().split('T')[0];
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
        expires_date: expiresDate.toISOString().split('T')[0],
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
    const { error } = await supabase
      .from('leftovers_inventory')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/leftovers/${id}/consume`, 'POST');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  updateServings: async (id: number, servings: number) => {
    const { data, error } = await supabase
      .from('leftovers_inventory')
      .update({ servings_remaining: servings })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/leftovers/${id}/servings`, 'PUT');
      throw error;
    }
    return wrapResponse(data);
  },

  getSuggestions: async () => {
    const { data, error } = await supabase.functions.invoke('leftover-suggestions');

    if (error) {
      errorLogger.logApiError(error, '/functions/leftover-suggestions', 'GET');
      throw error;
    }
    return wrapResponse(data as LeftoverSuggestion[]);
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
    const { error } = await supabase
      .from('school_menu_items')
      .delete()
      .eq('id', id);

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
    const { data, error } = await supabase.functions.invoke('lunch-alternatives', {
      body: { date },
    });

    if (error) {
      errorLogger.logApiError(error, `/school-menu/lunch-alternatives/${date}`, 'GET');
      throw error;
    }
    return wrapResponse(data as LunchAlternative);
  },

  parsePhoto: async (imageData: string, imageType: string, autoAdd: boolean = false) => {
    const { data, error } = await supabase.functions.invoke('parse-school-menu', {
      body: { image_data: imageData, image_type: imageType, auto_add: autoAdd },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-school-menu', 'POST');
      throw error;
    }
    return wrapResponse(data as { success: boolean; menu_items: SchoolMenuItem[]; count: number; added_count?: number });
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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from('school_menu_items')
      .delete()
      .lt('menu_date', cutoffDate.toISOString().split('T')[0]);

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
  getAll: async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .order('is_purchased')
      .order('category')
      .order('item_name');

    if (error) {
      errorLogger.logApiError(error, '/shopping', 'GET');
      throw error;
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
    const { data, error } = await supabase
      .from('shopping_items')
      .update(item)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/shopping/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as ShoppingItem);
  },

  delete: async (id: number) => {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/shopping/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  togglePurchased: async (id: number) => {
    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('shopping_items')
      .select('is_purchased')
      .eq('id', id)
      .single();

    if (fetchError) {
      errorLogger.logApiError(fetchError, `/shopping/${id}/toggle`, 'GET');
      throw fetchError;
    }

    const { data, error } = await supabase
      .from('shopping_items')
      .update({ is_purchased: !current?.is_purchased })
      .eq('id', id)
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
    const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
      body: { start_date: startDate, end_date: endDate },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/generate-shopping-list', 'POST');
      throw error;
    }
    return wrapResponse(data as ShoppingItem[]);
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
      errorLogger.logApiError(error, '/history', 'GET');
      throw error;
    }

    const transformed = data?.map(item => ({
      id: item.id,
      meal_id: item.meal_id,
      meal_name: item.meal?.name,
      cooked_date: item.cooked_date,
      rating: item.rating,
      notes: item.notes,
    })) as MealHistory[];

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
        cooked_date: history.cooked_date || new Date().toISOString().split('T')[0],
        rating: history.rating,
        notes: history.notes,
      })
      .select('*, meal:meals(name)')
      .single();

    if (error) {
      errorLogger.logApiError(error, '/history', 'POST');
      throw error;
    }

    return wrapResponse({
      id: data.id,
      meal_id: data.meal_id,
      meal_name: data.meal?.name,
      cooked_date: data.cooked_date,
      rating: data.rating,
      notes: data.notes,
    } as MealHistory);
  },

  update: async (id: number, history: Partial<MealHistory>) => {
    const { data, error } = await supabase
      .from('meal_history')
      .update({
        rating: history.rating,
        notes: history.notes,
      })
      .eq('id', id)
      .select('*, meal:meals(name)')
      .single();

    if (error) {
      errorLogger.logApiError(error, `/history/${id}`, 'PUT');
      throw error;
    }

    return wrapResponse({
      id: data.id,
      meal_id: data.meal_id,
      meal_name: data.meal?.name,
      cooked_date: data.cooked_date,
      rating: data.rating,
      notes: data.notes,
    } as MealHistory);
  },

  delete: async (id: number) => {
    const { error } = await supabase
      .from('meal_history')
      .delete()
      .eq('id', id);

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
  getAll: async (filters?: RestaurantFilters) => {
    let query = supabase.from('restaurants').select('*');

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

    const { data, error } = await query.order('name');

    if (error) {
      errorLogger.logApiError(error, '/restaurants', 'GET');
      throw error;
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
    const { data, error } = await supabase
      .from('restaurants')
      .update({ ...restaurant, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/restaurants/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  delete: async (id: number) => {
    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id);

    if (error) {
      errorLogger.logApiError(error, `/restaurants/${id}`, 'DELETE');
      throw error;
    }
    return wrapResponse({ success: true });
  },

  suggest: async (filters?: RestaurantFilters) => {
    const { data, error } = await supabase.functions.invoke('suggest-restaurant', {
      body: filters || {},
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/suggest-restaurant', 'POST');
      throw error;
    }
    return wrapResponse(data as Restaurant[]);
  },

  search: async (query: string) => {
    const { data, error } = await supabase.functions.invoke('search-restaurant', {
      body: { query },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/search-restaurant', 'POST');
      throw error;
    }
    return wrapResponse(data as Partial<Restaurant>);
  },

  scrape: async (id: number) => {
    const { data, error } = await supabase.functions.invoke('scrape-restaurant', {
      body: { restaurant_id: id },
    });

    if (error) {
      errorLogger.logApiError(error, `/functions/scrape-restaurant/${id}`, 'POST');
      throw error;
    }
    return wrapResponse(data as Restaurant);
  },

  scrapeUrl: async (url: string) => {
    const { data, error } = await supabase.functions.invoke('scrape-restaurant-url', {
      body: { url },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/scrape-restaurant-url', 'POST');
      throw error;
    }
    return wrapResponse(data as Partial<Restaurant>);
  },

  geocode: async (address: string) => {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address },
    });

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
  getItems: async () => {
    const { data, error } = await supabase
      .from('bento_items')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      errorLogger.logApiError(error, '/bento/items', 'GET');
      throw error;
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
    const { data, error } = await supabase
      .from('bento_items')
      .update(item)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/bento/items/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as BentoItem);
  },

  deleteItem: async (id: number) => {
    const { error } = await supabase
      .from('bento_items')
      .delete()
      .eq('id', id);

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
      errorLogger.logApiError(error, '/bento/plans', 'GET');
      throw error;
    }

    const transformed = data?.map(item => ({
      id: item.id,
      date: item.plan_date,
      child_name: item.child_name,
      compartment1: item.compartment1,
      compartment2: item.compartment2,
      compartment3: item.compartment3,
      compartment4: item.compartment4,
      notes: item.notes,
    })) as BentoPlan[];

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
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, `/bento/plans/${id}`, 'PUT');
      throw error;
    }
    return wrapResponse(data as BentoPlan);
  },

  deletePlan: async (id: number) => {
    const { error } = await supabase
      .from('bento_plans')
      .delete()
      .eq('id', id);

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
