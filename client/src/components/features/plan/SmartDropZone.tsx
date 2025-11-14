import React, { useMemo, useState } from 'react';
import { Plus, Sparkles, Clock, Star, Flame, TrendingUp, Calendar, ChefHat } from 'lucide-react';
import { Button } from '../../ui/button';
import type { Meal, MealPlan } from '../../../types/api';
import { cn } from '../../../lib/utils';

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

    // Sort by score and return top 4
    return scoredMeals
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(s => s.meal);
  }, [availableMeals, mealType, dayOfWeek, weekPlan]);

  const getMealTypeInfo = () => {
    switch (mealType) {
      case 'breakfast':
        return {
          emoji: '🥐',
          label: 'Breakfast',
          hint: 'Quick & energizing',
          color: 'from-amber-500/10 to-orange-500/10',
          borderColor: 'border-amber-500/30'
        };
      case 'morning_snack':
        return {
          emoji: '🍎',
          label: 'Morning Snack',
          hint: 'Light & healthy',
          color: 'from-green-500/10 to-emerald-500/10',
          borderColor: 'border-green-500/30'
        };
      case 'lunch':
        return {
          emoji: '🥗',
          label: 'Lunch',
          hint: 'Balanced & satisfying',
          color: 'from-blue-500/10 to-cyan-500/10',
          borderColor: 'border-blue-500/30'
        };
      case 'afternoon_snack':
        return {
          emoji: '🥨',
          label: 'Afternoon Snack',
          hint: 'Energy boost',
          color: 'from-purple-500/10 to-pink-500/10',
          borderColor: 'border-purple-500/30'
        };
      case 'dinner':
        return {
          emoji: '🍽️',
          label: 'Dinner',
          hint: 'Hearty & delicious',
          color: 'from-rose-500/10 to-red-500/10',
          borderColor: 'border-rose-500/30'
        };
      default:
        return {
          emoji: '🍴',
          label: 'Meal',
          hint: 'Plan something tasty',
          color: 'from-gray-500/10 to-slate-500/10',
          borderColor: 'border-gray-500/30'
        };
    }
  };

  const mealInfo = getMealTypeInfo();

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
        "relative group rounded-xl transition-all duration-200",
        "border-2 border-dashed",
        isDragOver
          ? `${mealInfo.borderColor} bg-gradient-to-br ${mealInfo.color} scale-[1.02] shadow-lg`
          : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30",
        "min-h-[140px]"
      )}
      onDrop={handleDropInternal}
      onDragOver={handleDragOverInternal}
      onDragLeave={handleDragLeaveInternal}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <ChefHat className="h-12 w-12 mx-auto mb-2 text-primary animate-bounce" />
            <p className="text-lg font-semibold text-primary">Drop to add!</p>
          </div>
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mealInfo.emoji}</span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{mealInfo.label}</h3>
              <p className="text-xs text-muted-foreground">{mealInfo.hint}</p>
            </div>
          </div>
          <Button
            onClick={onAdd}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && onSelectSuggestion && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="font-medium">Smart picks for you:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {smartSuggestions.map((meal) => (
                <button
                  key={meal.id}
                  className={cn(
                    "group/card relative overflow-hidden rounded-lg p-2 text-left",
                    "bg-gradient-to-br from-background to-accent/50",
                    "border border-primary/10 hover:border-primary/30",
                    "hover:shadow-md hover:scale-[1.02]",
                    "transition-all duration-200",
                    "min-h-[60px]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSuggestion(meal.id);
                  }}
                >
                  {/* Cuisine badge */}
                  {meal.cuisine && (
                    <div className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {meal.cuisine}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="font-medium text-xs leading-tight line-clamp-2 pr-12">
                      {meal.name}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {meal.cook_time_minutes && meal.cook_time_minutes > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{meal.cook_time_minutes}m</span>
                        </div>
                      )}
                      {meal.kid_rating && meal.kid_rating >= 4 && (
                        <div className="flex items-center gap-0.5 text-amber-600">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          <span>{meal.kid_rating}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {smartSuggestions.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-xs">Drag a recipe here</p>
            <p className="text-xs">or click + to browse</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartDropZone;
