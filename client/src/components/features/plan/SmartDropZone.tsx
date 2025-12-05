import React, { useMemo, useState } from 'react';
import { Plus, Clock, Star, Globe, Utensils } from 'lucide-react';
import type { Meal, MealPlan } from '../../../types/api';
import { cn } from '../../../lib/utils';
import { getCuisineColors } from '../../../utils/cuisineColors';

interface SmartDropZoneProps {
  mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
  dayOfWeek: string; // e.g., "Sunday", "Monday"
  date: string;
  onAdd: () => void;
  onSelectSuggestion?: (mealId: number) => void;
  availableMeals?: Meal[];
  weekPlan?: MealPlan[];
  onDrop: (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner', e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
}

const SmartDropZone: React.FC<SmartDropZoneProps> = ({
  mealType,
  dayOfWeek,
  date,
  onAdd,
  onSelectSuggestion,
  availableMeals = [],
  weekPlan = [],
  onDrop,
  onDragOver,
  onDragLeave,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Intelligent suggestions based on multiple factors
  const smartSuggestions = useMemo(() => {
    if (!availableMeals || availableMeals.length === 0) return [];

    // Filter meals by type
    let typeMeals = availableMeals.filter(m => m.meal_type === mealType.replace('_snack', '') as any);

    // Handle snacks
    if (mealType.includes('snack')) {
      typeMeals = availableMeals.filter(m => m.meal_type === 'snack');
    }

    // Get meals already planned this week
    const plannedMealIds = new Set(
      weekPlan.map(p => p.meal_id).filter(Boolean)
    );

    // Score each meal based on contextual factors
    const scoredMeals = typeMeals.map(meal => {
      let score = 0;

      // Variety bonus: prefer meals not already planned this week
      if (!plannedMealIds.has(meal.id)) {
        score += 50;
      }

      // Time-appropriate scoring
      if (mealType === 'breakfast') {
        // Quick meals for breakfast
        if (meal.cook_time_minutes && meal.cook_time_minutes <= 15) score += 30;
        if (meal.cook_time_minutes && meal.cook_time_minutes <= 10) score += 20;
      } else if (mealType === 'lunch') {
        // Bento-friendly or quick meals
        if (meal.tags?.toLowerCase().includes('bento')) score += 40;
        if (meal.cook_time_minutes && meal.cook_time_minutes <= 30) score += 20;
      } else if (mealType === 'dinner') {
        // Kid-friendly and family meals
        if (meal.kid_rating && meal.kid_rating >= 4) score += 35;
        if (meal.kid_rating && meal.kid_rating === 5) score += 15;
      } else if (mealType.includes('snack')) {
        // Quick and healthy snacks
        if (meal.cook_time_minutes && meal.cook_time_minutes <= 5) score += 30;
      }

      // Day-specific preferences
      if (dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday') {
        // Weekend: longer cooking times OK
        if (meal.cook_time_minutes && meal.cook_time_minutes > 45) score += 20;
      } else {
        // Weekday: prefer quicker meals
        if (meal.cook_time_minutes && meal.cook_time_minutes <= 30) score += 15;
      }

      // Cuisine diversity
      if (meal.cuisine) {
        const cuisinesThisWeek = weekPlan
          .map(p => p.cuisine)
          .filter(Boolean);
        if (!cuisinesThisWeek.includes(meal.cuisine)) score += 25;
      }

      // Popularity/rating boost
      if (meal.kid_rating) score += meal.kid_rating * 5;

      return { meal, score };
    });

    // Sort by score and return top suggestions
    return scoredMeals
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(s => s.meal);
  }, [availableMeals, mealType, dayOfWeek, weekPlan]);

  // Get the best single suggestion
  const topSuggestion = smartSuggestions[0];
  const additionalSuggestions = smartSuggestions.slice(1);

  const handleDragOverInternal = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    onDragOver?.(e);
  };

  const handleDragLeaveInternal = (e: React.DragEvent) => {
    setIsDragOver(false);
    onDragLeave?.(e);
  };

  const handleDropInternal = (e: React.DragEvent) => {
    setIsDragOver(false);
    onDrop(date, mealType, e);
  };

  return (
    <div
      className={cn(
        "relative rounded-lg transition-all duration-200",
        "border-2 border-dashed",
        isDragOver
          ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
        "min-h-[80px]"
      )}
      onDrop={handleDropInternal}
      onDragOver={handleDragOverInternal}
      onDragLeave={handleDragLeaveInternal}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-primary/5 rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-primary">Drop here</p>
          </div>
        </div>
      )}

      <div className="p-3">
        {/* Single Best Suggestion - Clean & Focused */}
        {topSuggestion && onSelectSuggestion && !showAllSuggestions ? (
          <div className="space-y-2">
            <button
              className={cn(
                "w-full group relative overflow-hidden rounded-lg p-3 text-left",
                "bg-white border border-slate-200",
                "hover:border-primary/50 hover:shadow-sm",
                "transition-all duration-200"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSuggestion(topSuggestion.id);
              }}
            >
              <div className="flex items-start gap-3">
                {/* Cuisine indicator */}
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  topSuggestion.cuisine ? getCuisineColors(topSuggestion.cuisine).bg : "bg-slate-100"
                )}>
                  {topSuggestion.cuisine ? (
                    <Globe className={cn("h-4 w-4", getCuisineColors(topSuggestion.cuisine).text)} />
                  ) : (
                    <Utensils className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                    {topSuggestion.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {topSuggestion.cook_time_minutes && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {topSuggestion.cook_time_minutes}m
                      </span>
                    )}
                    {topSuggestion.kid_rating && topSuggestion.kid_rating >= 4 && (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <Star className="h-3 w-3 fill-current" />
                        {topSuggestion.kid_rating}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick add indicator */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
              </div>
            </button>

            {/* More options link */}
            <div className="flex items-center justify-between px-1">
              {additionalSuggestions.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllSuggestions(true);
                  }}
                  className="text-xs text-slate-400 hover:text-primary transition-colors"
                >
                  +{additionalSuggestions.length} more
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="text-xs text-slate-400 hover:text-primary transition-colors ml-auto"
              >
                Browse all
              </button>
            </div>
          </div>
        ) : showAllSuggestions && smartSuggestions.length > 0 && onSelectSuggestion ? (
          /* Expanded suggestions view */
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Suggestions</span>
              <button
                onClick={() => setShowAllSuggestions(false)}
                className="text-xs text-slate-400 hover:text-primary"
              >
                Show less
              </button>
            </div>
            <div className="space-y-1.5">
              {smartSuggestions.map((meal) => (
                <button
                  key={meal.id}
                  className="w-full flex items-center gap-2 p-2 rounded-md text-left bg-white border border-slate-100 hover:border-primary/30 hover:bg-slate-50 transition-all text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSuggestion(meal.id);
                  }}
                >
                  <span className={cn(
                    "flex-shrink-0 w-6 h-6 rounded flex items-center justify-center",
                    meal.cuisine ? getCuisineColors(meal.cuisine).bg : "bg-slate-100"
                  )}>
                    {meal.cuisine ? (
                      <Globe className={cn("h-3 w-3", getCuisineColors(meal.cuisine).text)} />
                    ) : (
                      <Utensils className="h-3 w-3 text-slate-400" />
                    )}
                  </span>
                  <span className="flex-1 truncate text-slate-700">{meal.name}</span>
                  {meal.cook_time_minutes && (
                    <span className="flex-shrink-0 text-xs text-slate-400">
                      {meal.cook_time_minutes}m
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="w-full text-xs text-slate-400 hover:text-primary transition-colors pt-1"
            >
              Browse all recipes
            </button>
          </div>
        ) : (
          /* Clean empty state */
          <div
            className="flex flex-col items-center justify-center py-4 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
              <Plus className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400">Add meal</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartDropZone;
