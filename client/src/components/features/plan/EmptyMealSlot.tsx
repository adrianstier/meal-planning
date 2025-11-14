import React, { useMemo } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import type { Meal } from '../../../types/api';

interface EmptyMealSlotProps {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  onAdd: () => void;
  onSelectSuggestion?: (mealId: number) => void;
  availableMeals?: Meal[];
  dayOfWeek?: string; // e.g., "Sunday", "Monday"
}

const EmptyMealSlot: React.FC<EmptyMealSlotProps> = ({
  mealType,
  onAdd,
  onSelectSuggestion,
  availableMeals = [],
  dayOfWeek,
}) => {
  // Get meal type specific suggestions
  const suggestions = useMemo(() => {
    if (!availableMeals || availableMeals.length === 0) return [];

    // Filter meals by type
    const typeMeals = availableMeals.filter(m => m.meal_type === mealType);

    // Prioritize quick meals for breakfast
    if (mealType === 'breakfast') {
      return typeMeals
        .filter(m => !m.cook_time_minutes || m.cook_time_minutes <= 15)
        .sort((a, b) => (a.cook_time_minutes || 0) - (b.cook_time_minutes || 0))
        .slice(0, 2);
    }

    // Prioritize kid-friendly for dinner
    if (mealType === 'dinner') {
      return typeMeals
        .filter(m => m.kid_rating && m.kid_rating >= 4)
        .sort((a, b) => (b.kid_rating || 0) - (a.kid_rating || 0))
        .slice(0, 2);
    }

    // For lunch, prioritize bento-friendly or quick meals
    if (mealType === 'lunch') {
      return typeMeals
        .filter(m => m.tags?.includes('bento') || (m.cook_time_minutes && m.cook_time_minutes <= 30))
        .slice(0, 2);
    }

    // Default: return random suggestions
    return typeMeals
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
  }, [availableMeals, mealType]);

  const getMealTypeEmoji = () => {
    switch (mealType) {
      case 'breakfast': return '🥐';
      case 'lunch': return '🥗';
      case 'dinner': return '🍽️';
      case 'snack': return '🍎';
      default: return '🍴';
    }
  };

  const getMealTypeLabel = () => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  return (
    <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 hover:border-primary/50 hover:bg-accent/40 transition-all group hover:shadow-sm">
      <div className="w-full">
        <button
          className="w-full text-left p-2 bg-transparent hover:bg-accent/20 rounded-md flex items-center gap-3 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors cursor-pointer border-0 min-h-[44px]"
          onClick={onAdd}
        >
          <Plus className="h-5 w-5 flex-shrink-0" />
          <span className="text-base">{getMealTypeEmoji()} Add {getMealTypeLabel()}</span>
        </button>

        {suggestions.length > 0 && onSelectSuggestion && (
          <div className="w-full mt-2">
            <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Quick picks:
            </div>
            <div className="flex flex-col gap-2">
              {suggestions.map((meal) => (
                <button
                  key={meal.id}
                  className="w-full text-left px-3 py-2.5 text-sm rounded-md bg-primary/5 hover:bg-primary/15 border border-primary/10 hover:border-primary/30 transition-all hover:shadow-sm whitespace-normal min-h-[44px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSuggestion(meal.id);
                  }}
                >
                  <div className="font-medium break-words leading-snug">{meal.name}</div>
                  {meal.cook_time_minutes && meal.cook_time_minutes > 0 && (
                    <div className="text-muted-foreground text-xs mt-1">
                      {meal.cook_time_minutes} min
                      {meal.kid_rating && meal.kid_rating >= 4 && ' • ⭐ Kid favorite'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyMealSlot;
