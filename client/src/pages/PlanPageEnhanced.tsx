import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Sparkles, ShoppingCart, Undo2, Redo2, LayoutGrid, List, Minimize2, BookOpen } from 'lucide-react';
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
import { useWeekPlan, useGenerateWeekPlan, useApplyGeneratedPlan, useDeletePlanItem, useAddPlanItem } from '../hooks/usePlan';
import { useGenerateShoppingList } from '../hooks/useShopping';
import { useMeals } from '../hooks/useMeals';
import { useDragDrop } from '../contexts/DragDropContext';
import AddMealDialog from '../components/features/plan/AddMealDialog';
import MealCard from '../components/features/plan/MealCard';
import EmptyMealSlot from '../components/features/plan/EmptyMealSlot';
import PlanSkeleton from '../components/features/plan/PlanSkeleton';
import WeeklyVarietySummary from '../components/features/plan/WeeklyVarietySummary';
import RecipeBrowserSidebar from '../components/features/plan/RecipeBrowserSidebar';
import CompactDayCard from '../components/features/plan/CompactDayCard';
import type { MealPlan } from '../types/api';

type ViewMode = 'week' | 'list' | 'compact';

const PlanPageEnhanced: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('planViewMode') as ViewMode) || 'compact';
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
  } | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [generateBentos, setGenerateBentos] = useState(false);
  const [bentoChildName, setBentoChildName] = useState('');
  const [recipeBrowserOpen, setRecipeBrowserOpen] = useState(() => {
    const stored = localStorage.getItem('recipeBrowserOpen');
    console.log('Initial recipeBrowserOpen state:', stored);
    return stored === 'true' || stored === null; // Default to true if never set
  });

  // Undo/Redo state
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { data: weekPlan, isLoading, error } = useWeekPlan(currentWeekStart);
  const { data: meals } = useMeals();
  const generateWeekPlan = useGenerateWeekPlan();
  const applyGeneratedPlan = useApplyGeneratedPlan();
  const generateShoppingList = useGenerateShoppingList();
  const deletePlanItem = useDeletePlanItem();
  const addPlanItem = useAddPlanItem();
  const { draggedRecipe } = useDragDrop();

  // Handle drop event
  const handleDrop = async (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner', e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedRecipe) return;

    try {
      // Map frontend meal types to backend types
      let backendMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = mealType as any;
      if (mealType === 'morning_snack' || mealType === 'afternoon_snack') {
        backendMealType = 'snack'; // Backend still uses generic 'snack'
      }

      await addPlanItem.mutateAsync({
        meal_id: draggedRecipe.meal.id,
        plan_date: date,
        meal_type: backendMealType,
      });
    } catch (error) {
      console.error('Failed to add meal to plan:', error);
    }
  };

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('planViewMode', viewMode);
  }, [viewMode]);

  // Save recipe browser state
  useEffect(() => {
    localStorage.setItem('recipeBrowserOpen', recipeBrowserOpen.toString());
  }, [recipeBrowserOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && !e.shiftKey) {
        goToPreviousWeek();
      } else if (e.key === 'ArrowRight' && !e.shiftKey) {
        goToNextWeek();
      }
      // G for generate
      else if (e.key === 'g' || e.key === 'G') {
        handleGenerateWeek();
      }
      // T for this week
      else if (e.key === 't' || e.key === 'T') {
        goToThisWeek();
      }
      // V for view mode toggle
      else if (e.key === 'v' || e.key === 'V') {
        setViewMode(prev => prev === 'week' ? 'list' : prev === 'list' ? 'compact' : 'week');
      }
      // Cmd/Ctrl + Z for undo
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd/Ctrl + Shift + Z for redo
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [historyIndex, history, currentWeekStart]);

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
          morning_snack: [],
          lunch: [],
          afternoon_snack: [],
          dinner: [],
        };
      }

      // Map meal_type to the appropriate slot
      // Split snacks between morning and afternoon slots
      if (meal.meal_type === 'snack') {
        // Distribute snacks between morning and afternoon
        const morningCount = organized[meal.plan_date]['morning_snack'].length;
        const afternoonCount = organized[meal.plan_date]['afternoon_snack'].length;
        if (morningCount <= afternoonCount) {
          organized[meal.plan_date]['morning_snack'].push(meal);
        } else {
          organized[meal.plan_date]['afternoon_snack'].push(meal);
        }
      } else {
        organized[meal.plan_date][meal.meal_type].push(meal);
      }
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

  // Days with meals for compact view
  const daysWithMeals = useMemo(() => {
    return weekDays.filter(day =>
      mealsByDate[day.date] &&
      Object.values(mealsByDate[day.date]).some(meals => meals.length > 0)
    );
  }, [weekDays, mealsByDate]);

  // Undo/Redo functions
  const saveToHistory = useCallback((action: any) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(action);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const action = history[historyIndex];
      // Implement undo logic based on action type
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const action = history[historyIndex + 1];
      // Implement redo logic based on action type
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

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

  const handleAddMeal = (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner') => {
    setSelectedSlot({ date, mealType });
    setDialogOpen(true);
  };

  const handleDeleteMeal = async (mealPlanId: number) => {
    if (window.confirm('Remove this meal from your plan?')) {
      try {
        await deletePlanItem.mutateAsync(mealPlanId);
        saveToHistory({ type: 'delete', mealPlanId });
      } catch (error) {
        console.error('Failed to delete meal:', error);
      }
    }
  };

  const handleCopyMeal = (meal: MealPlan) => {
    // TODO: Show dialog to select target date
    alert('Copy meal feature - select a date to copy to');
  };

  const handleMoveMeal = (meal: MealPlan) => {
    // TODO: Show dialog to select target slot
    alert('Move meal feature - select a slot to move to');
  };

  const handleSwapMeal = (meal: MealPlan) => {
    // TODO: Show dialog to select meal to swap with
    alert('Swap meal feature - select another meal to swap with');
  };

  const handleQuickAddSuggestion = async (mealId: number, date: string, mealType: string) => {
    try {
      await addPlanItem.mutateAsync({
        meal_id: mealId,
        plan_date: date,
        meal_type: mealType as "breakfast" | "lunch" | "dinner" | "snack",
      });
    } catch (error) {
      console.error('Failed to add suggested meal:', error);
    }
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

      if (generateBentos && (result.data as any).bentoMessage) {
        alert((result.data as any).bentoMessage);
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
    return <PlanSkeleton />;
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

  const renderDayCard = (day: typeof weekDays[0]) => {
    const dayMeals = mealsByDate[day.date] || {
      breakfast: [],
      morning_snack: [],
      lunch: [],
      afternoon_snack: [],
      dinner: [],
    };

    const isTodayCard = isToday(parseISO(day.date));

    return (
      <Card
        key={day.date}
        className={`flex flex-col ${isTodayCard ? 'ring-2 ring-primary bg-primary/5' : ''}`}
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
          <div
            className="space-y-1 p-2 rounded transition-colors"
            onDrop={(e) => handleDrop(day.date, 'breakfast', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/10');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/10');
            }}
          >
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
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <EmptyMealSlot
                mealType="breakfast"
                onAdd={() => handleAddMeal(day.date, 'breakfast')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'breakfast')}
                availableMeals={meals}
                dayOfWeek={day.dayName}
              />
            )}
          </div>

          {/* Lunch */}
          <div
            className="space-y-1 p-2 rounded transition-colors"
            onDrop={(e) => handleDrop(day.date, 'lunch', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/10');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/10');
            }}
          >
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
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <EmptyMealSlot
                mealType="lunch"
                onAdd={() => handleAddMeal(day.date, 'lunch')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'lunch')}
                availableMeals={meals}
                dayOfWeek={day.dayName}
              />
            )}
          </div>

          {/* Dinner */}
          <div
            className="space-y-1 p-2 rounded transition-colors"
            onDrop={(e) => handleDrop(day.date, 'dinner', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/10');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/10');
            }}
          >
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
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <EmptyMealSlot
                mealType="dinner"
                onAdd={() => handleAddMeal(day.date, 'dinner')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'dinner')}
                availableMeals={meals}
                dayOfWeek={day.dayName}
              />
            )}
          </div>

          {/* Morning Snack */}
          {dayMeals.morning_snack.length > 0 && (
            <div
              className="space-y-1 p-2 rounded transition-colors"
              onDrop={(e) => handleDrop(day.date, 'morning_snack', e)}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-primary/10');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-primary/10');
              }}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-muted-foreground">Morning Snack</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleAddMeal(day.date, 'morning_snack')}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {dayMeals.morning_snack.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))}
            </div>
          )}

          {/* Afternoon Snack */}
          {dayMeals.afternoon_snack.length > 0 && (
            <div
              className="space-y-1 p-2 rounded transition-colors"
              onDrop={(e) => handleDrop(day.date, 'afternoon_snack', e)}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-primary/10');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-primary/10');
              }}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-muted-foreground">Afternoon Snack</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleAddMeal(day.date, 'afternoon_snack')}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {dayMeals.afternoon_snack.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Recipe Browser Sidebar */}
      <RecipeBrowserSidebar
        meals={meals}
        isOpen={recipeBrowserOpen}
        onClose={() => setRecipeBrowserOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          {/* Header with Week Navigation */}
          <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Title and Actions Row */}
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Weekly Meal Plan</CardTitle>
                <CardDescription>
                  {format(parseISO(currentWeekStart), 'MMM d')} -{' '}
                  {format(addDays(parseISO(currentWeekStart), 6), 'MMM d, yyyy')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Recipe Browser Toggle */}
                <Button
                  variant={recipeBrowserOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    console.log('Recipes button clicked, current state:', recipeBrowserOpen);
                    setRecipeBrowserOpen(!recipeBrowserOpen);
                  }}
                  className="h-8"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Recipes
                </Button>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 border rounded-md p-1">
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode('week')}
                   
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode('list')}
                   
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'compact' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode('compact')}
                   
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                   
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                   
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="default"
                  onClick={handleGenerateWeek}
                  disabled={generateWeekPlan.isPending}
                 
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generateWeekPlan.isPending ? 'Generating...' : 'Generate Week'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateShoppingList}
                  disabled={generateShoppingList.isPending}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {generateShoppingList.isPending ? 'Generating...' : 'Shopping List'}
                </Button>
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

            {/* Weekly Variety Summary */}
            {weekPlan && weekPlan.length > 0 && (
              <WeeklyVarietySummary weekPlan={weekPlan} />
            )}

            {/* Cuisine Filter */}
            {uniqueCuisines.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-start gap-3">
                  <div className="text-sm font-medium text-muted-foreground min-w-[80px] pt-1.5">
                    Cuisines:
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
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>
                {selectedCuisines.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 ml-[92px]">
                    Generating meals from: {selectedCuisines.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Bento Box Generation Options */}
            <div className="pt-4 border-t">
              <div className="flex items-start gap-3">
                <div className="text-sm font-medium text-muted-foreground min-w-[80px] pt-1.5">
                  Bento Boxes:
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generateBentos}
                      onChange={(e) => setGenerateBentos(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Generate bento box lunches for the week</span>
                  </label>
                  {generateBentos && (
                    <div className="ml-6">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Child's name (optional)</span>
                        <input
                          type="text"
                          value={bentoChildName}
                          onChange={(e) => setBentoChildName(e.target.value)}
                          placeholder="e.g., Emma"
                          className="text-sm px-3 py-1.5 rounded-md border border-input bg-background"
                        />
                      </label>
                      <p className="text-xs text-muted-foreground mt-2">
                        Will create 5 bento box plans (Mon-Fri) with varied items from your collection
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <span className="font-medium">Keyboard shortcuts:</span> ← → (navigate weeks) • G (generate) • T (this week) • V (view mode) • Cmd+Z (undo) • Cmd+Shift+Z (redo)
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Grid / List / Compact View */}
      {(() => {
        if (viewMode === 'compact') {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map(day => (
                <CompactDayCard
                  key={day.date}
                  date={day.date}
                  dayName={day.dayName}
                  dayShort={day.dayShort}
                  dayNum={day.dayNum}
                  month={day.month}
                  meals={(mealsByDate[day.date] as { breakfast: MealPlan[]; morning_snack: MealPlan[]; lunch: MealPlan[]; afternoon_snack: MealPlan[]; dinner: MealPlan[]; }) || {
                    breakfast: [],
                    morning_snack: [],
                    lunch: [],
                    afternoon_snack: [],
                    dinner: [],
                  }}
                  onDrop={handleDrop}
                  onMealClick={(meal) => {
                    setSelectedMeal(meal);
                    setViewDialogOpen(true);
                  }}
                />
              ))}
            </div>
          );
        } else if (viewMode === 'week') {
          return (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map(day => renderDayCard(day))}
            </div>
          );
        } else if (viewMode === 'list') {
          return (
            <div className="space-y-4">
              {weekDays.map(day => (
                <div key={day.date}>
                  {renderDayCard(day)}
                </div>
              ))}
            </div>
          );
        }
        return null;
      })()}

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
                    🌍 {item.cuisine}
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
        </div>
      </div>
    </div>
  );
};

export default PlanPageEnhanced;
