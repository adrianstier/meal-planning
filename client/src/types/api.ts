// Meal types
export interface Meal {
  id: number;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cook_time_minutes?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string;
  ingredients?: string;
  instructions?: string;
  created_at: string;
  is_favorite?: boolean;
  last_cooked?: string;
  makes_leftovers?: boolean;
  leftover_servings?: number;
  leftover_days?: number;
  kid_rating?: number;
  image_url?: string;
  cuisine?: string;
  source_url?: string;
  top_comments?: string;
}

export interface MealPlan {
  id: number;
  plan_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_id: number;
  meal_name?: string;
  notes?: string;
  cook_time_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  tags?: string;
  ingredients?: string;
  instructions?: string;
}

// Leftovers types
export interface Leftover {
  id: number;
  meal_id: number;
  meal_name: string;
  cooked_date: string;
  servings_remaining: number;
  expires_date: string;
  days_until_expiry: number;
  notes?: string;
  created_at: string;
}

export interface LeftoverSuggestion {
  meal_id: number;
  meal_name: string;
  suggestion: string;
  servings_remaining: number;
  days_until_expiry: number;
}

// School menu types
export interface SchoolMenuItem {
  id: number;
  menu_date: string;
  meal_name: string;
  meal_type: 'breakfast' | 'lunch' | 'snack';
  description?: string;
  created_at: string;
  dislike_count?: number;
}

export interface MenuFeedback {
  id: number;
  menu_item_id: number;
  feedback_type: 'disliked' | 'allergic' | 'wont_eat';
  notes?: string;
  created_at: string;
}

export interface LunchAlternative {
  date: string;
  school_menu: SchoolMenuItem[];
  needs_alternative: boolean;
  available_leftovers: Leftover[];
  quick_lunch_options: Meal[];
  recommendation: string;
}

export interface CalendarData {
  [date: string]: {
    breakfast: SchoolMenuItem[];
    lunch: SchoolMenuItem[];
    snack: SchoolMenuItem[];
  };
}

// Shopping list types
export interface ShoppingItem {
  id: number;
  item_name: string;
  category?: string;
  quantity?: string;
  is_purchased: boolean;
  created_at: string;
}

// History types
export interface MealHistory {
  id: number;
  meal_id: number;
  meal_name: string;
  cooked_date: string;
  rating?: number;
  notes?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface MealWithHistory extends Meal {
  cook_count?: number;
  last_cooked?: string;
  avg_rating?: number;
}

// Constraints for meal planning
export interface PlanConstraints {
  max_cook_time?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  avoid_recent_days?: number;
  prefer_favorites?: boolean;
  use_leftovers?: boolean;
}
