import axios from 'axios';
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
  ApiResponse,
  PlanConstraints,
  LeftoverSuggestion,
  Restaurant,
  RestaurantFilters,
} from '../types/api';

// API base URL - use relative URLs in production, localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001'
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to log outgoing requests
api.interceptors.request.use(
  (config) => {
    // Log requests in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });
    }
    return config;
  },
  (error) => {
    errorLogger.logNetworkError(error, { phase: 'request' });
    return Promise.reject(error);
  }
);

// Response interceptor to unwrap Flask API responses and log errors
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    // If response has success field, unwrap the data
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    // Extract error message from Flask API response { success: false, error: "message" }
    const originalMessage = error.message;
    if (error.response?.data?.error) {
      error.message = error.response.data.error;
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }

    // Log the API error with detailed context
    errorLogger.logApiError(
      error,
      error.config?.url || 'unknown',
      error.config?.method?.toUpperCase() || 'UNKNOWN',
      error.config?.data
    );

    // Add helpful context to error for debugging
    error.context = {
      endpoint: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      originalMessage,
      apiBaseUrl: API_BASE_URL,
    };

    return Promise.reject(error);
  }
);

// Meal API
export const mealsApi = {
  getAll: () => api.get<Meal[]>('/api/meals'),
  getById: (id: number) => api.get<Meal>(`/api/meals/${id}`),
  create: (meal: Partial<Meal>) => api.post<Meal>('/api/meals', meal),
  update: (id: number, meal: Partial<Meal>) => api.put<Meal>(`/api/meals/${id}`, meal),
  delete: (id: number) => api.delete(`/api/meals/${id}`),
  bulkDelete: (mealIds: number[]) => api.post<{ deleted_count: number }>('/api/meals/bulk-delete', { meal_ids: mealIds }),
  parseRecipe: (text: string) => api.post<Meal>('/api/meals/parse', { recipe_text: text }, { timeout: 90000 }), // 90 second timeout for recipe parsing
  parseRecipeFromImage: (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.post<Meal>('/api/meals/parse-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minute timeout for image parsing
    });
  },
  search: (query: string) => api.get<Meal[]>(`/api/meals/search?q=${encodeURIComponent(query)}`),
  favorite: (id: number) => api.post(`/api/meals/${id}/favorite`),
  unfavorite: (id: number) => api.delete(`/api/meals/${id}/favorite`),
  updateLeftoverSettings: (id: number, settings: { makes_leftovers: boolean; leftover_servings?: number; leftover_days?: number }) =>
    api.put(`/api/meals/${id}/leftover-settings`, settings),
};

// Meal Plan API
export const planApi = {
  getWeek: (startDate: string) => api.get<MealPlan[]>(`/api/plan/week?start_date=${startDate}`),
  add: (plan: Partial<MealPlan>) => api.post<MealPlan>('/api/plan', plan),
  update: (id: number, plan: Partial<MealPlan>) => api.put<MealPlan>(`/api/plan/${id}`, plan),
  delete: (id: number) => api.delete(`/api/plan/${id}`),
  clearWeek: (startDate: string) => api.post('/api/plan/clear-week', { start_date: startDate }),
  suggest: (date: string, mealType: string, constraints?: PlanConstraints) =>
    api.post<Meal[]>('/api/plan/suggest', { date, meal_type: mealType, ...constraints }),
  generateWeek: (startDate: string, numDays?: number, mealTypes?: string[], avoidSchoolDuplicates?: boolean, cuisines?: string[] | 'all', generateBentos?: boolean, bentoChildName?: string) =>
    api.post<any[]>('/api/plan/generate-week', {
      start_date: startDate,
      num_days: numDays,
      meal_types: mealTypes,
      avoid_school_duplicates: avoidSchoolDuplicates,
      cuisines: cuisines,
      generate_bentos: generateBentos,
      bento_child_name: bentoChildName
    }),
  applyGenerated: (plan: any[]) => api.post('/api/plan/apply-generated', { plan }),
};

// Leftovers API
export const leftoversApi = {
  getActive: () => api.get<Leftover[]>('/api/leftovers'),
  add: (leftover: { meal_id: number; cooked_date?: string; servings?: number; days_good?: number; notes?: string }) =>
    api.post<Leftover>('/api/leftovers', leftover),
  consume: (id: number) => api.post(`/api/leftovers/${id}/consume`),
  updateServings: (id: number, servings: number) => api.put(`/api/leftovers/${id}/servings`, { servings_remaining: servings }),
  getSuggestions: () => api.get<LeftoverSuggestion[]>('/api/leftovers/suggestions'),
};

// School Menu API
export const schoolMenuApi = {
  getAll: () => api.get<SchoolMenuItem[]>('/api/school-menu'),
  getByDate: (date: string) => api.get<SchoolMenuItem[]>(`/api/school-menu?date=${date}`),
  getRange: (startDate: string, endDate: string) =>
    api.get<SchoolMenuItem[]>(`/api/school-menu?start_date=${startDate}&end_date=${endDate}`),
  add: (item: Partial<SchoolMenuItem>) => api.post<SchoolMenuItem>('/api/school-menu', item),
  addBulk: (items: Partial<SchoolMenuItem>[]) => api.post('/api/school-menu', { items }),
  delete: (id: number) => api.delete(`/api/school-menu/${id}`),
  addFeedback: (menuItemId: number, feedbackType: 'disliked' | 'allergic' | 'wont_eat', notes?: string) =>
    api.post<MenuFeedback>('/api/school-menu/feedback', { menu_item_id: menuItemId, feedback_type: feedbackType, notes }),
  getLunchAlternatives: (date: string) => api.get<LunchAlternative>(`/api/school-menu/lunch-alternatives/${date}`),
  parsePhoto: (imageData: string, imageType: string, autoAdd: boolean = false) =>
    api.post<{ success: boolean; menu_items: SchoolMenuItem[]; count: number; added_count?: number }>(
      '/api/school-menu/parse-photo',
      { image_data: imageData, image_type: imageType, auto_add: autoAdd },
      { timeout: 60000 } // 60 second timeout for vision API
    ),
  getCalendar: (startDate?: string, endDate?: string) => {
    let url = '/api/school-menu/calendar';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    return api.get<{ success: boolean; calendar_data: CalendarData }>(url);
  },
  cleanup: (daysOld: number = 60) => api.post('/api/school-menu/cleanup', { days_old: daysOld }),
};

// Shopping List API
export const shoppingApi = {
  getAll: () => api.get<ShoppingItem[]>('/api/shopping'),
  add: (item: Partial<ShoppingItem>) => api.post<ShoppingItem>('/api/shopping', item),
  update: (id: number, item: Partial<ShoppingItem>) => api.put<ShoppingItem>(`/api/shopping/${id}`, item),
  delete: (id: number) => api.delete(`/api/shopping/${id}`),
  togglePurchased: (id: number) => api.post(`/api/shopping/${id}/toggle`),
  clearPurchased: () => api.delete('/api/shopping/purchased'),
  clearAll: () => api.delete('/api/shopping/all'),
  generateFromPlan: (startDate: string, endDate: string) =>
    api.post<ShoppingItem[]>('/api/shopping/generate', { start_date: startDate, end_date: endDate }),
};

// History API
export const historyApi = {
  getAll: () => api.get<MealHistory[]>('/api/history'),
  add: (history: Partial<MealHistory>) => api.post<MealHistory>('/api/history', history),
  update: (id: number, history: Partial<MealHistory>) => api.put<MealHistory>(`/api/history/${id}`, history),
  delete: (id: number) => api.delete(`/api/history/${id}`),
  getByMeal: (mealId: number) => api.get<MealHistory[]>(`/api/history/meal/${mealId}`),
};

// Restaurant API
export const restaurantsApi = {
  getAll: (filters?: RestaurantFilters) => {
    const params = new URLSearchParams();
    if (filters?.cuisine_type) params.append('cuisine', filters.cuisine_type);
    if (filters?.outdoor_seating !== undefined) params.append('outdoor_seating', filters.outdoor_seating.toString());
    if (filters?.has_bar !== undefined) params.append('has_bar', filters.has_bar.toString());
    const queryString = params.toString();
    return api.get<Restaurant[]>(`/api/restaurants${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id: number) => api.get<Restaurant>(`/api/restaurants/${id}`),
  create: (restaurant: Partial<Restaurant>) => api.post<Restaurant>('/api/restaurants', restaurant),
  update: (id: number, restaurant: Partial<Restaurant>) => api.put<Restaurant>(`/api/restaurants/${id}`, restaurant),
  delete: (id: number) => api.delete(`/api/restaurants/${id}`),
  suggest: (filters?: RestaurantFilters) => api.post<Restaurant[]>('/api/restaurants/suggest', filters || {}),
  search: (query: string) => api.post<Partial<Restaurant>>('/api/restaurants/search', { query }),
  scrape: (id: number) => api.post<Restaurant>(`/api/restaurants/${id}/scrape`),
  scrapeUrl: (url: string) => api.post<Partial<Restaurant>>('/api/restaurants/scrape-url', { url }),
  geocode: (address: string) => api.post<{ latitude: number; longitude: number; display_name: string }>('/api/restaurants/geocode', { address }),
};

export default api;
