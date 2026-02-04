import React, { useState } from 'react';
import { parseISO, isToday } from 'date-fns';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import MealCard from './MealCard';
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
  onMealDelete?: (mealPlanId: number) => void;
  mealDisplayMode?: 'dinners' | '3-meals' | 'all';
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
  onMealDelete,
  mealDisplayMode = 'all',
}) => {
  const [expanded, setExpanded] = useState(false);
  const isTodayCard = isToday(parseISO(date));

  // Helper to determine which meals to show
  const shouldShowMeal = (mealType: string): boolean => {
    if (mealDisplayMode === 'all') return true;
    if (mealDisplayMode === 'dinners') return mealType === 'dinner';
    if (mealDisplayMode === '3-meals') return ['breakfast', 'lunch', 'dinner'].includes(mealType);
    return false;
  };

  const allMealTypes: Array<{ key: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner'; label: string }> = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'morning_snack', label: 'Morning Snack' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'afternoon_snack', label: 'Afternoon Snack' },
    { key: 'dinner', label: 'Dinner' },
  ];

  const mealTypes = allMealTypes.filter(mealType => shouldShowMeal(mealType.key));

  const totalMeals = Object.entries(meals)
    .filter(([mealType]) => shouldShowMeal(mealType))
    .flatMap(([_, mealList]) => mealList).length;

  return (
    <Card className={`${isTodayCard ? 'border-slate-300' : 'border-slate-200'}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-slate-900">
              {dayName}
              {isTodayCard && <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">(Today)</span>}
            </div>
            <div className="text-xs text-slate-500">
              {month} {dayNum}
            </div>
          </div>
          {totalMeals > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Meal Slots */}
      <div className="p-2 space-y-1.5">
        {mealTypes.map(({ key, label }) => {
          const mealList = meals[key];
          const hasMeals = mealList.length > 0;

          return (
            <div
              key={key}
              className={`relative border transition-all ${
                hasMeals
                  ? 'border-slate-200 bg-white'
                  : 'border-dashed border-slate-300 bg-slate-50'
              }`}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                onDrop(date, key, e);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
              }}
            >
              {/* Compact View */}
              {!expanded && (
                <div className="p-2">
                  <div className="text-xs font-medium text-slate-700 mb-1.5">{label}</div>
                  {hasMeals ? (
                    <div className="space-y-1">
                      {mealList.map((meal) => (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          onClick={() => onMealClick?.(meal)}
                          onDelete={onMealDelete ? () => onMealDelete(meal.id) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-xs text-slate-400 py-2">
                      <Plus className="h-3 w-3" />
                      <span>Drag here</span>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded View */}
              {expanded && (
                <div className="p-2 space-y-1.5">
                  <div className="text-xs font-medium text-slate-700 mb-1.5">{label}</div>
                  {hasMeals ? (
                    <div className="space-y-1">
                      {mealList.map((meal) => (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          onClick={() => onMealClick?.(meal)}
                          onDelete={onMealDelete ? () => onMealDelete(meal.id) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-center text-slate-400 py-2 border border-dashed border-slate-300 bg-slate-50">
                      <Plus className="h-3.5 w-3.5 mx-auto mb-1" />
                      <div>Drag a recipe here</div>
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
