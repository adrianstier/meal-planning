import { supabase } from './supabase';
import { errorLogger } from '../utils/errorLogger';
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

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// Helper to wrap responses in expected format
const wrapResponse = <T>(data: T) => ({ data });

// ============================================================================
// MEALS API
// ============================================================================

export const mealsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .order('name');

    if (error) {
      errorLogger.logApiError(error, '/meals', 'GET');
      throw error;
    }
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
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('meals')
      .insert({ ...meal, user_id: userId })
      .select()
      .single();

    if (error) {
      errorLogger.logApiError(error, '/meals', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  update: async (id: number, meal: Partial<Meal>) => {
    const { data, error } = await supabase
      .from('meals')
      .update({ ...meal, updated_at: new Date().toISOString() })
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
    // Call Edge Function for AI parsing
    const { data, error } = await supabase.functions.invoke('parse-recipe', {
      body: { recipe_text: text },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromImage: async (imageFile: File) => {
    // Convert file to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const { data, error } = await supabase.functions.invoke('parse-recipe-image', {
      body: { image_data: base64, image_type: imageFile.type },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-image', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromUrl: async (url: string) => {
    const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
      body: { url },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-url', 'POST');
      throw error;
    }
    return wrapResponse(data as Meal);
  },

  parseRecipeFromUrlAI: async (url: string) => {
    const { data, error } = await supabase.functions.invoke('parse-recipe-url-ai', {
      body: { url },
    });

    if (error) {
      errorLogger.logApiError(error, '/functions/parse-recipe-url-ai', 'POST');
      throw error;
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
    const updateData: any = {};
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

  applyGenerated: async (plan: any[]) => {
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
  getAll: async () => {
    const { data, error } = await supabase
      .from('school_menu_items')
      .select('*')
      .order('menu_date', { ascending: false });

    if (error) {
      errorLogger.logApiError(error, '/school-menu', 'GET');
      throw error;
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
  getAll: async () => {
    const { data, error } = await supabase
      .from('meal_history')
      .select('*, meal:meals(name)')
      .order('cooked_date', { ascending: false });

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
