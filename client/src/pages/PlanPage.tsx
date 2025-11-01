import React, { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useWeekPlan } from '../hooks/usePlan';
import type { MealPlan } from '../types/api';

const PlanPage: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  });

  const { data: weekPlan, isLoading, error } = useWeekPlan(currentWeekStart);

  // Generate 7 days starting from currentWeekStart
  const weekDays = useMemo(() => {
    const start = parseISO(currentWeekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEEE'),
        dayShort: format(date, 'EEE'),
        dayNum: format(date, 'd'),
        month: format(date, 'MMM'),
      };
    });
  }, [currentWeekStart]);

  // Organize meals by date and type
  const mealsByDate = useMemo(() => {
    if (!weekPlan) return {};

    const organized: Record<string, Record<string, MealPlan[]>> = {};

    weekPlan.forEach((meal) => {
      if (!organized[meal.plan_date]) {
        organized[meal.plan_date] = {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        };
      }
      organized[meal.plan_date][meal.meal_type].push(meal);
    });

    return organized;
  }, [weekPlan]);

  const goToPreviousWeek = () => {
    const prevWeek = addDays(parseISO(currentWeekStart), -7);
    setCurrentWeekStart(format(prevWeek, 'yyyy-MM-dd'));
  };

  const goToNextWeek = () => {
    const nextWeek = addDays(parseISO(currentWeekStart), 7);
    setCurrentWeekStart(format(nextWeek, 'yyyy-MM-dd'));
  };

  const goToThisWeek = () => {
    const today = new Date();
    setCurrentWeekStart(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Meal Plan</CardTitle>
            <CardDescription>Loading your meal plan...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Meal Plan</CardTitle>
            <CardDescription>Error loading meal plan</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              Failed to load meal plan. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Meal Plan</CardTitle>
              <CardDescription>
                {format(parseISO(currentWeekStart), 'MMM d')} -{' '}
                {format(addDays(parseISO(currentWeekStart), 6), 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToThisWeek}>
                This Week
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayMeals = mealsByDate[day.date] || {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
          };

          return (
            <Card key={day.date} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  <div className="hidden md:block">{day.dayName}</div>
                  <div className="md:hidden">{day.dayShort}</div>
                </CardTitle>
                <CardDescription>
                  {day.month} {day.dayNum}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                {/* Breakfast */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-muted-foreground">Breakfast</h4>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.breakfast.length > 0 ? (
                    dayMeals.breakfast.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                      >
                        {meal.meal_name}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No meal planned</div>
                  )}
                </div>

                {/* Lunch */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-muted-foreground">Lunch</h4>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.lunch.length > 0 ? (
                    dayMeals.lunch.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                      >
                        {meal.meal_name}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No meal planned</div>
                  )}
                </div>

                {/* Dinner */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-muted-foreground">Dinner</h4>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.dinner.length > 0 ? (
                    dayMeals.dinner.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                      >
                        {meal.meal_name}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No meal planned</div>
                  )}
                </div>

                {/* Snacks */}
                {dayMeals.snack.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-muted-foreground">Snacks</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {dayMeals.snack.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors text-xs"
                      >
                        {meal.meal_name}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PlanPage;
