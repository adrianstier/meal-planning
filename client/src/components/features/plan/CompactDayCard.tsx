import React, { useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import type { MealPlan } from '../../../types/api';

interface CompactDayCardProps {
  date: string;
  dayName: string;
  dayShort: string;
  dayNum: string;
  month: string;
  meals: {
    breakfast: MealPlan[];
    morning_snack: MealPlan[];
    lunch: MealPlan[];
    afternoon_snack: MealPlan[];
    dinner: MealPlan[];
  };
  onDrop: (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner', e: React.DragEvent) => void;
  onMealClick?: (meal: MealPlan) => void;
}

const CompactDayCard: React.FC<CompactDayCardProps> = ({
  date,
  dayName,
  dayShort,
  dayNum,
  month,
  meals,
  onDrop,
  onMealClick,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isTodayCard = isToday(parseISO(date));

  const mealTypes: Array<{ key: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner'; label: string; emoji: string }> = [
    { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
    { key: 'morning_snack', label: 'Morning Snack', emoji: '🍎' },
    { key: 'lunch', label: 'Lunch', emoji: '🥗' },
    { key: 'afternoon_snack', label: 'Afternoon Snack', emoji: '🍊' },
    { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  ];

  const totalMeals = Object.values(meals).flat().length;

  return (
    <Card className={`${isTodayCard ? 'ring-2 ring-primary' : ''}`}>
      {/* Header */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {dayName}
              {isTodayCard && <span className="ml-2 text-xs text-primary">(Today)</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {month} {dayNum}
            </div>
          </div>
          {totalMeals > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Meal Slots */}
      <div className="p-2 space-y-2">
        {mealTypes.map(({ key, label, emoji }) => {
          const mealList = meals[key];
          const hasMeals = mealList.length > 0;

          return (
            <div
              key={key}
              className={`relative rounded-lg border-2 border-dashed transition-all ${
                hasMeals
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-muted-foreground/20 bg-muted/10'
              } hover:border-primary/50 hover:bg-primary/10`}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('!border-primary', '!bg-primary/20', 'shadow-lg');
                onDrop(date, key, e);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('!border-primary', '!bg-primary/20', 'shadow-lg');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('!border-primary', '!bg-primary/20', 'shadow-lg');
              }}
            >
              {/* Compact View */}
              {!expanded && (
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    {hasMeals ? (
                      <div className="flex items-center gap-1">
                        <div className="text-xs text-muted-foreground">
                          {mealList.length} meal{mealList.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60">Drop here</div>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded View */}
              {expanded && (
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {hasMeals ? (
                    <div className="space-y-1.5">
                      {mealList.map((meal) => (
                        <div
                          key={meal.id}
                          onClick={() => onMealClick?.(meal)}
                          className="p-2 bg-background rounded border border-border hover:border-primary cursor-pointer transition-colors"
                        >
                          <div className="text-sm font-medium">{meal.meal_name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {meal.cook_time_minutes && meal.cook_time_minutes > 0 && (
                              <span>{meal.cook_time_minutes} min</span>
                            )}
                            {meal.cuisine && (
                              <span className="px-1.5 py-0.5 bg-primary/10 rounded">
                                {meal.cuisine}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-center text-muted-foreground/60 py-2">
                      Drop a recipe here
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default CompactDayCard;
