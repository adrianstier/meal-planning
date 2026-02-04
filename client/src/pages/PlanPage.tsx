import React, { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Sparkles, ShoppingCart, Clock, Baby, Package, Utensils, MoreVertical, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useWeekPlan, useGenerateWeekPlan, useApplyGeneratedPlan } from '../hooks/usePlan';
import { useGenerateShoppingList } from '../hooks/useShopping';
import { useMeals } from '../hooks/useMeals';
import AddMealDialog from '../components/features/plan/AddMealDialog';
import { OnboardingTour } from '../components/OnboardingTour';
import type { MealPlan } from '../types/api';

const PlanPage: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  } | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [generateBentos, setGenerateBentos] = useState(false);
  const [bentoChildName, setBentoChildName] = useState('');

  const { data: weekPlan, isLoading, error } = useWeekPlan(currentWeekStart);
  const { data: meals } = useMeals();
  const generateWeekPlan = useGenerateWeekPlan();
  const applyGeneratedPlan = useApplyGeneratedPlan();
  const generateShoppingList = useGenerateShoppingList();

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

  // Get unique cuisines from all meals
  const uniqueCuisines = useMemo(() => {
    if (!meals) return [];
    return Array.from(
      new Set(meals.map(m => m.cuisine).filter(Boolean))
    ).sort();
  }, [meals]);

  // Toggle cuisine selection
  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

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

  const handleAddMeal = (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setSelectedSlot({ date, mealType });
    setDialogOpen(true);
  };

  // Helper to check if meal has specific tag
  const hasTag = (tags: string | null | undefined, tag: string) => {
    return tags?.toLowerCase().includes(tag.toLowerCase());
  };

  // Helper to render meal badges
  const renderMealBadges = (meal: MealPlan) => {
    const badges = [];

    if (meal.cook_time_minutes && meal.cook_time_minutes <= 30) {
      badges.push(
        <span key="quick" className="inline-flex items-center text-xs text-orange-700">
          <Clock className="h-3 w-3 mr-0.5" />
          {meal.cook_time_minutes}m
        </span>
      );
    }

    if (hasTag(meal.meal_tags, 'kid-friendly')) {
      badges.push(
        <span key="kid" className="inline-flex items-center text-xs text-blue-700">
          <Baby className="h-3 w-3" />
        </span>
      );
    }

    if (hasTag(meal.meal_tags, 'bento')) {
      badges.push(
        <span key="bento" className="inline-flex items-center text-xs text-green-700">
          <Package className="h-3 w-3" />
        </span>
      );
    }

    if (hasTag(meal.meal_tags, 'leftovers')) {
      badges.push(
        <span key="leftovers" className="inline-flex items-center text-xs text-purple-700">
          <Utensils className="h-3 w-3" />
        </span>
      );
    }

    return badges;
  };

  const handleGenerateWeek = async () => {
    try {
      const result = await generateWeekPlan.mutateAsync({
        startDate: currentWeekStart,
        numDays: 7,
        mealTypes: ['dinner'],
        avoidSchoolDuplicates: true,
        cuisines: selectedCuisines.length > 0 ? selectedCuisines : 'all',
        generateBentos: generateBentos,
        bentoChildName: bentoChildName
      });
      setGeneratedPlan(result.data);
      setGenerateDialogOpen(true);

      // Show success message if bentos were also generated
      // Type guard for optional bentoMessage property that may be present in the response
      const resultData = result.data as { bentoMessage?: string } | undefined;
      if (generateBentos && resultData && 'bentoMessage' in resultData && resultData.bentoMessage) {
        alert(resultData.bentoMessage);
      }
    } catch (error) {
      console.error('Failed to generate week plan:', error);
      alert('Failed to generate meal plan. Please try again.');
    }
  };

  const handleApplyPlan = async () => {
    try {
      await applyGeneratedPlan.mutateAsync(generatedPlan);
      setGenerateDialogOpen(false);
      setGeneratedPlan([]);
    } catch (error) {
      console.error('Failed to apply plan:', error);
      alert('Failed to apply meal plan. Please try again.');
    }
  };

  const handleGenerateShoppingList = async () => {
    try {
      const endDate = format(addDays(parseISO(currentWeekStart), 6), 'yyyy-MM-dd');
      const result = await generateShoppingList.mutateAsync({
        startDate: currentWeekStart,
        endDate: endDate
      });
      alert(`Shopping list generated! Added ${result.data.length} items organized by category. Check the Shopping tab.`);
    } catch (error) {
      console.error('Failed to generate shopping list:', error);
      alert('Failed to generate shopping list. Please try again.');
    }
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
        <CardHeader className="space-y-4">
          {/* Week Navigation Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[280px] text-center">
                <CardTitle className="text-lg">
                  {format(parseISO(currentWeekStart), 'MMM d')} -{' '}
                  {format(addDays(parseISO(currentWeekStart), 6), 'MMM d, yyyy')}
                </CardTitle>
              </div>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button data-tour-id="this-week" variant="outline" size="sm" onClick={goToThisWeek}>
                Today
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                data-tour-id="generate-week"
                variant="default"
                size="sm"
                onClick={handleGenerateWeek}
                disabled={generateWeekPlan.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {generateWeekPlan.isPending ? 'Generating...' : 'Generate Week'}
              </Button>
              <Button
                data-tour-id="shopping-list"
                variant="outline"
                size="sm"
                onClick={handleGenerateShoppingList}
                disabled={generateShoppingList.isPending}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Shopping List
              </Button>
            </div>
          </div>
          {/* Generation Options */}
          <div className="pt-4 border-t space-y-3">
            {/* Cuisine Filter */}
            {uniqueCuisines.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="text-sm font-medium text-muted-foreground min-w-[100px] pt-1">
                  Filter Cuisines:
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {uniqueCuisines.map((cuisine) => (
                    <Button
                      key={cuisine}
                      variant={selectedCuisines.includes(cuisine || '') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleCuisine(cuisine || '')}
                      className="h-7 text-xs"
                    >
                      {cuisine}
                    </Button>
                  ))}
                  {selectedCuisines.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCuisines([])}
                      className="h-7 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Bento Box Options */}
            <div className="flex items-start gap-3">
              <div className="text-sm font-medium text-muted-foreground min-w-[100px] pt-1">
                Bento Lunches:
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateBentos}
                    onChange={(e) => setGenerateBentos(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Generate bento boxes (Mon-Fri)</span>
                </label>
                {generateBentos && (
                  <div className="ml-6 flex items-center gap-2">
                    <input
                      type="text"
                      value={bentoChildName}
                      onChange={(e) => setBentoChildName(e.target.value)}
                      placeholder="Child's name (optional)"
                      className="text-sm px-3 py-1.5 rounded-md border border-input bg-background w-48"
                    />
                  </div>
                )}
              </div>
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

          const isTodayCard = isToday(parseISO(day.date));

          const isFirstDay = day.date === weekDays[0].date;

          return (
            <Card
              key={day.date}
              className={`flex flex-col ${isTodayCard ? 'ring-2 ring-primary bg-primary/5' : ''}`}
              data-tour-id={isFirstDay ? "week-day-card" : undefined}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  <div className="hidden md:block">
                    {day.dayName}
                    {isTodayCard && <span className="ml-2 text-xs font-normal text-primary">(Today)</span>}
                  </div>
                  <div className="md:hidden">
                    {day.dayShort}
                    {isTodayCard && <span className="ml-1 text-xs font-normal text-primary">•</span>}
                  </div>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleAddMeal(day.date, 'breakfast')}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.breakfast.length > 0 ? (
                    dayMeals.breakfast.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setViewDialogOpen(true);
                        }}
                      >
                        <div className="font-medium text-sm mb-0.5">{meal.meal_name}</div>
                        {renderMealBadges(meal).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {renderMealBadges(meal)}
                          </div>
                        )}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleAddMeal(day.date, 'lunch')}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.lunch.length > 0 ? (
                    dayMeals.lunch.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setViewDialogOpen(true);
                        }}
                      >
                        <div className="font-medium text-sm mb-0.5">{meal.meal_name}</div>
                        {renderMealBadges(meal).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {renderMealBadges(meal)}
                          </div>
                        )}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleAddMeal(day.date, 'dinner')}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {dayMeals.dinner.length > 0 ? (
                    dayMeals.dinner.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setViewDialogOpen(true);
                        }}
                      >
                        <div className="font-medium text-sm mb-0.5">{meal.meal_name}</div>
                        {renderMealBadges(meal).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {renderMealBadges(meal)}
                          </div>
                        )}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleAddMeal(day.date, 'snack')}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {dayMeals.snack.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-2 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors text-xs"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setViewDialogOpen(true);
                        }}
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

      {/* View Meal Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMeal?.meal_name}</DialogTitle>
            <DialogDescription>
              <div className="flex gap-3 text-sm mt-2">
                {selectedMeal?.cook_time_minutes && (
                  <span>{selectedMeal.cook_time_minutes} min</span>
                )}
                {selectedMeal?.difficulty && (
                  <span className="capitalize">{selectedMeal.difficulty}</span>
                )}
                {selectedMeal?.servings && <span>{selectedMeal.servings} servings</span>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {selectedMeal?.tags && (
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedMeal.tags.split(',').map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 text-sm rounded-full bg-secondary"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedMeal?.ingredients && (
              <div>
                <h3 className="font-semibold mb-2">Ingredients</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedMeal.ingredients}
                  </pre>
                </div>
              </div>
            )}
            {selectedMeal?.instructions && (
              <div>
                <h3 className="font-semibold mb-2">Instructions</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedMeal.instructions}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog */}
      {selectedSlot && (
        <AddMealDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          date={selectedSlot.date}
          mealType={selectedSlot.mealType}
        />
      )}

      {/* Generated Plan Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Meal Plan</DialogTitle>
            <DialogDescription>
              Review the generated meal plan below. Meals are automatically selected to avoid duplicates with school lunch
              {selectedCuisines.length > 0 && ` and balanced across ${selectedCuisines.join(', ')} cuisines`}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {generatedPlan.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.meal_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(item.date), 'EEEE, MMM d')} - {item.meal_type}
                  </p>
                </div>
                {item.cuisine && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800">
                    <Globe className="h-3 w-3 mr-1" /> {item.cuisine}
                  </span>
                )}
              </div>
            ))}
            {generatedPlan.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No meals generated. Make sure you have recipes in your collection.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyPlan}
              disabled={applyGeneratedPlan.isPending || generatedPlan.length === 0}
            >
              {applyGeneratedPlan.isPending ? 'Applying...' : 'Apply to Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Tour */}
      <OnboardingTour
        tourKey="plan-page"
        steps={[
          {
            id: "welcome",
            target: "[data-tour-id='generate-week']",
            title: "Welcome to Your Meal Planner!",
            content: "Let's take a quick tour of the key features. Click 'Generate Week' to automatically create a full week of meals based on your recipes.",
            position: "bottom"
          },
          {
            id: "shopping",
            target: "[data-tour-id='shopping-list']",
            title: "Generate Shopping Lists",
            content: "Once your week is planned, click here to automatically generate a shopping list with all ingredients organized by category.",
            position: "bottom"
          },
          {
            id: "navigation",
            target: "[data-tour-id='this-week']",
            title: "Navigate Between Weeks",
            content: "Use these buttons to view different weeks. 'This Week' brings you back to the current week.",
            position: "bottom"
          },
          {
            id: "day-card",
            target: "[data-tour-id='week-day-card']",
            title: "Daily Meal Cards",
            content: "Each day shows breakfast, lunch, dinner, and snacks. Click the + button to manually add meals to any slot.",
            position: "right"
          },
        ]}
      />
    </div>
  );
};

export default PlanPage;
