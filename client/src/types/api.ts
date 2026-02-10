// Meal types
export interface Meal {
  id: number;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cook_time_minutes?: number;
  prep_time_minutes?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string;
  ingredients?: string;
  instructions?: string;
  created_at: string;
  updated_at?: string;
  is_favorite?: boolean;
  last_cooked?: string;
  makes_leftovers?: boolean;
  leftover_servings?: number;
  leftover_days?: number;
  kid_friendly_level?: number;
  kid_rating?: number;
  image_url?: string;
  cuisine?: string;
  source_url?: string;
  top_comments?: string;
  is_leftover?: boolean;
  original_meal_id?: number;
  times_cooked?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
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
  meal_tags?: string;
  ingredients?: string;
  instructions?: string;
  cuisine?: string;
  image_url?: string;
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


// Constraints for meal planning
export interface PlanConstraints {
  max_cook_time?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  avoid_recent_days?: number;
  prefer_favorites?: boolean;
  use_leftovers?: boolean;
}

// Bento box types
export interface BentoItem {
  id: number;
  name: string;
  category: string;
  is_favorite: boolean;
  allergens?: string;
  notes?: string;
  prep_time_minutes?: number;
  created_at: string;
}

interface BentoCompartment {
  id: number;
  name: string;
  category: string;
}

export interface BentoPlan {
  id: number;
  date: string;
  child_name?: string;
  compartment1?: BentoCompartment | null;
  compartment2?: BentoCompartment | null;
  compartment3?: BentoCompartment | null;
  compartment4?: BentoCompartment | null;
  notes?: string;
}

// Restaurant types
export interface Restaurant {
  id: number;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  cuisine_type?: string;
  price_range?: string;
  hours_data?: Record<string, unknown> | null; // JSONB in database
  happy_hour_info?: Record<string, unknown> | null; // JSONB in database
  outdoor_seating: boolean;
  has_bar: boolean;
  takes_reservations: boolean;
  good_for_groups: boolean;
  kid_friendly: boolean;
  rating?: number;
  notes?: string;
  tags?: string;
  image_url?: string;
  last_scraped?: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantFilters {
  cuisine_type?: string;
  outdoor_seating?: boolean;
  has_bar?: boolean;
  kid_friendly?: boolean;
  price_range?: string;
}
