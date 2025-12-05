import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  ShoppingCart,
  LayoutGrid,
  Minimize2,
  BookOpen,
  Minus,
  Users,
  Trash2,
  Baby,
  Package,
  Utensils,
  Coffee,
  Pizza,
  ChefHat,
  Cookie,
  AlertCircle,
  Timer,
  Apple,
  Globe
} from 'lucide-react';
import { scaleIngredients, calculateServingMultiplier } from '../utils/ingredientScaler';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';
import '../styles/meal-plan-enhanced.css';
import { useWeekPlan, useGenerateWeekPlan, useApplyGeneratedPlan, useDeletePlanItem, useAddPlanItem, useClearWeekPlan } from '../hooks/usePlan';
import { useGenerateShoppingList } from '../hooks/useShopping';
import { useMeals } from '../hooks/useMeals';
import { useDragDrop } from '../contexts/DragDropContext';
import AddMealDialog from '../components/features/plan/AddMealDialog';
import MealCard from '../components/features/plan/MealCard';
import SmartDropZone from '../components/features/plan/SmartDropZone';
import PlanSkeleton from '../components/features/plan/PlanSkeleton';
import WeeklyVarietySummary from '../components/features/plan/WeeklyVarietySummary';
import RecipeBrowserSidebar from '../components/features/plan/RecipeBrowserSidebar';
import CompactDayCard from '../components/features/plan/CompactDayCard';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { OnboardingTour } from '../components/OnboardingTour';
import type { MealPlan } from '../types/api';

type ViewMode = 'week' | 'list' | 'compact';
type MealDisplayMode = 'dinners' | '3-meals' | 'all';

// Meal type configurations with colors and icons for enhanced UX
const mealTypeConfig = {
  breakfast: {
    label: 'Breakfast',
    icon: Coffee,
    color: 'from-orange-400 to-yellow-400',
    bgColor: 'bg-gradient-to-br from-orange-50 to-yellow-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    time: '7:00 AM'
  },
  morning_snack: {
    label: 'Morning Snack',
    icon: Cookie,
    color: 'from-green-400 to-emerald-400',
    bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    time: '10:00 AM'
  },
  lunch: {
    label: 'Lunch',
    icon: Pizza,
    color: 'from-blue-400 to-cyan-400',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    time: '12:00 PM'
  },
  afternoon_snack: {
    label: 'Afternoon Snack',
    icon: Cookie,
    color: 'from-teal-400 to-green-400',
    bgColor: 'bg-gradient-to-br from-teal-50 to-green-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-700',
    time: '3:00 PM'
  },
  dinner: {
    label: 'Dinner',
    icon: ChefHat,
    color: 'from-purple-400 to-pink-400',
    bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    time: '6:00 PM'
  }
};

const PlanPageEnhanced: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('planViewMode') as ViewMode) || 'compact';
  });

  const [mealDisplayMode, setMealDisplayMode] = useState<MealDisplayMode>('dinners');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [adjustedServings, setAdjustedServings] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
  } | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [generateBentos, setGenerateBentos] = useState(false);
  const [bentoChildName, setBentoChildName] = useState('');
  const [recipeBrowserOpen, setRecipeBrowserOpen] = useState(true);
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);

  // Confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clearWeekConfirmOpen, setClearWeekConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Undo/Redo state
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Enhanced UX states
  const [showStats, setShowStats] = useState(true);
  const [copiedMeal, setCopiedMeal] = useState<MealPlan | null>(null);
  const [filterMealType, setFilterMealType] = useState<string>('all');

  const { data: weekPlan, isLoading, error } = useWeekPlan(currentWeekStart);
  const { data: meals } = useMeals();
  const generateWeekPlan = useGenerateWeekPlan();
  const applyGeneratedPlan = useApplyGeneratedPlan();
  const generateShoppingList = useGenerateShoppingList();
  const deletePlanItem = useDeletePlanItem();
  const addPlanItem = useAddPlanItem();
  const clearWeekPlan = useClearWeekPlan();
  const { draggedRecipe } = useDragDrop();

  // Handle drop event
  const handleDrop = async (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner', e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedRecipe) {
      return;
    }

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

  // Save meal display mode preference
  useEffect(() => {
    localStorage.setItem('mealDisplayMode', mealDisplayMode);
  }, [mealDisplayMode]);

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

  // Generate 7 days starting from currentWeekStart with enhanced properties
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
        isToday: isToday(date),
        isTomorrow: isTomorrow(date),
        isYesterday: isYesterday(date),
        isPast: date < new Date() && !isToday(date),
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

  // Calculate weekly statistics for enhanced dashboard
  const weeklyStats = useMemo(() => {
    if (!weekPlan) return {
      totalMeals: 0,
      totalCookTime: 0,
      plannedDays: 0,
      completionRate: 0,
      quickMeals: 0,
      kidFriendly: 0,
      bentoBoxes: 0,
      averageCookTime: 0
    };

    const stats = {
      totalMeals: weekPlan.length,
      totalCookTime: weekPlan.reduce((sum, meal) => sum + (meal.cook_time_minutes || 0), 0),
      plannedDays: new Set(weekPlan.map(m => m.plan_date)).size,
      completionRate: 0,
      quickMeals: weekPlan.filter(m => m.cook_time_minutes && m.cook_time_minutes <= 30).length,
      kidFriendly: weekPlan.filter(m => m.meal_tags?.includes('kid-friendly')).length,
      bentoBoxes: weekPlan.filter(m => m.meal_tags?.includes('bento')).length,
      averageCookTime: 0
    };

    // Calculate completion rate (meals planned vs possible meals)
    const possibleMeals = 7 * 3; // 7 days * 3 main meals
    stats.completionRate = Math.round((stats.totalMeals / possibleMeals) * 100);

    // Calculate average cook time
    if (stats.totalMeals > 0) {
      stats.averageCookTime = Math.round(stats.totalCookTime / stats.totalMeals);
    }

    return stats;
  }, [weekPlan]);

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

  const handleDeleteMeal = (mealPlanId: number) => {
    setPendingDeleteId(mealPlanId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMeal = async () => {
    if (pendingDeleteId === null) return;

    try {
      await deletePlanItem.mutateAsync(pendingDeleteId);
      saveToHistory({ type: 'delete', mealPlanId: pendingDeleteId });
    } catch (error) {
      console.error('Failed to delete meal:', error);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleClearWeek = () => {
    setClearWeekConfirmOpen(true);
  };

  const confirmClearWeek = async () => {
    try {
      await clearWeekPlan.mutateAsync(currentWeekStart);
    } catch (error) {
      console.error('Failed to clear week:', error);
    }
  };

  const handleCopyMeal = (meal: MealPlan) => {
    setCopiedMeal(meal);
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-up';
    toast.textContent = 'Meal copied! Click any empty slot to paste.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handlePasteMeal = async (date: string, mealType: string) => {
    if (!copiedMeal) return;
    try {
      await addPlanItem.mutateAsync({
        meal_id: copiedMeal.meal_id,
        plan_date: date,
        meal_type: mealType as any
      });
      setCopiedMeal(null);
    } catch (error) {
      console.error('Failed to paste meal:', error);
    }
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

  // Enhanced badge renderer with better colors and icons
  const renderEnhancedBadges = (meal: any) => {
    const badges = [];

    if (meal.cook_time_minutes) {
      const timeColor = meal.cook_time_minutes <= 20 ? 'bg-green-100 text-green-700' :
                       meal.cook_time_minutes <= 30 ? 'bg-yellow-100 text-yellow-700' :
                       'bg-orange-100 text-orange-700';
      badges.push(
        <Badge key="time" className={cn("gap-1", timeColor)}>
          <Timer className="h-3 w-3" />
          {meal.cook_time_minutes}m
        </Badge>
      );
    }

    if (meal.meal_tags?.includes('kid-friendly')) {
      badges.push(
        <Badge key="kid" className="bg-blue-100 text-blue-700 gap-1">
          <Baby className="h-3 w-3" />
          Kid
        </Badge>
      );
    }

    if (meal.meal_tags?.includes('bento')) {
      badges.push(
        <Badge key="bento" className="bg-purple-100 text-purple-700 gap-1">
          <Package className="h-3 w-3" />
          Bento
        </Badge>
      );
    }

    if (meal.meal_tags?.includes('leftovers')) {
      badges.push(
        <Badge key="leftovers" className="bg-indigo-100 text-indigo-700 gap-1">
          <Utensils className="h-3 w-3" />
          Leftover
        </Badge>
      );
    }

    if (meal.difficulty === 'easy') {
      badges.push(
        <Badge key="easy" className="bg-green-100 text-green-700">
          Easy
        </Badge>
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container py-8">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Loading Your Meal Plan...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Utensils className="h-6 w-6 text-purple-600 animate-pulse" />
                  </div>
                </div>
                <p className="text-muted-foreground animate-pulse">Preparing your delicious week...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
        <div className="container py-8">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur border-red-200">
            <CardHeader>
              <CardTitle className="text-2xl text-red-600 flex items-center gap-2">
                <AlertCircle className="h-6 w-6" />
                Error Loading Meal Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">
                Failed to load your meal plan. Please try refreshing the page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Helper to determine which meals to show based on display mode
  const shouldShowMeal = (mealType: string): boolean => {
    if (mealDisplayMode === 'all') return true;
    if (mealDisplayMode === 'dinners') return mealType === 'dinner';
    if (mealDisplayMode === '3-meals') return ['breakfast', 'lunch', 'dinner'].includes(mealType);
    return false;
  };

  const renderDayCard = (day: typeof weekDays[0]) => {
    const dayMeals = mealsByDate[day.date] || {
      breakfast: [],
      morning_snack: [],
      lunch: [],
      afternoon_snack: [],
      dinner: [],
    };

    const isTodayCard = isToday(parseISO(day.date));
    const isPastDay = day.isPast;
    const mealsPlanned = Object.values(dayMeals).flat().length;

    return (
      <div
        key={day.date}
        className={cn(
          "group flex flex-col bg-white rounded-xl transition-all duration-200 overflow-hidden",
          isTodayCard
            ? "ring-2 ring-primary ring-offset-2 shadow-lg"
            : isPastDay
            ? "opacity-60 hover:opacity-90"
            : "border border-slate-200 hover:border-slate-300 hover:shadow-md"
        )}
      >
        {/* Day Header */}
        <div className={cn(
          "px-4 py-3",
          isTodayCard
            ? "bg-gradient-to-r from-primary/10 to-primary/5"
            : "bg-slate-50/80"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Date circle */}
              <div className={cn(
                "w-11 h-11 rounded-full flex flex-col items-center justify-center",
                isTodayCard
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200"
              )}>
                <span className={cn(
                  "text-lg font-bold leading-none",
                  isTodayCard ? "text-white" : "text-slate-900"
                )}>
                  {day.dayNum}
                </span>
                <span className={cn(
                  "text-[10px] uppercase tracking-wide",
                  isTodayCard ? "text-white/80" : "text-slate-400"
                )}>
                  {day.month}
                </span>
              </div>
              <div>
                <h3 className={cn(
                  "text-base font-semibold",
                  isTodayCard ? "text-primary" : "text-slate-900"
                )}>
                  {day.dayName}
                </h3>
                {isTodayCard && (
                  <span className="text-xs font-medium text-primary/70">
                    Today
                  </span>
                )}
              </div>
            </div>
            {/* Meal count indicator */}
            {mealsPlanned > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  mealsPlanned >= 3 ? "bg-green-500" : mealsPlanned >= 1 ? "bg-amber-500" : "bg-slate-300"
                )} />
                <span>{mealsPlanned} meal{mealsPlanned !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Meals */}
        <div className="flex-1 p-4 space-y-5">
          {/* Breakfast */}
          {shouldShowMeal('breakfast') && (
          <div
            className="space-y-2"
            onDrop={(e) => handleDrop(day.date, 'breakfast', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/5', 'rounded-lg');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/5', 'rounded-lg');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-amber-400" />
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Breakfast
                </h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'breakfast')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {dayMeals.breakfast.length > 0 ? (
              dayMeals.breakfast.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setAdjustedServings(null);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <SmartDropZone
                mealType="breakfast"
                dayOfWeek={day.dayName}
                date={day.date}
                onAdd={() => handleAddMeal(day.date, 'breakfast')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'breakfast')}
                availableMeals={meals}
                weekPlan={weekPlan}
                onDrop={handleDrop}
              />
            )}
          </div>
          )}

          {/* Morning Snack */}
          {shouldShowMeal('morning_snack') && dayMeals.morning_snack.length > 0 && (
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
                <h4 className="font-semibold text-xs text-muted-foreground flex items-center gap-1"><Apple className="h-3 w-3" /> Morning Snack</h4>
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
                    setAdjustedServings(null);
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

          {/* Lunch */}
          {shouldShowMeal('lunch') && (
          <div
            className="space-y-2"
            onDrop={(e) => handleDrop(day.date, 'lunch', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/5', 'rounded-lg');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/5', 'rounded-lg');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-blue-400" />
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Lunch
                </h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'lunch')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {dayMeals.lunch.length > 0 ? (
              dayMeals.lunch.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setAdjustedServings(null);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <SmartDropZone
                mealType="lunch"
                dayOfWeek={day.dayName}
                date={day.date}
                onAdd={() => handleAddMeal(day.date, 'lunch')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'lunch')}
                availableMeals={meals}
                weekPlan={weekPlan}
                onDrop={handleDrop}
              />
            )}
          </div>
          )}

          {/* Afternoon Snack */}
          {shouldShowMeal('afternoon_snack') && dayMeals.afternoon_snack.length > 0 && (
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
                <h4 className="font-semibold text-xs text-muted-foreground flex items-center gap-1"><Apple className="h-3 w-3" /> Afternoon Snack</h4>
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
                    setAdjustedServings(null);
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

          {/* Dinner */}
          {shouldShowMeal('dinner') && (
          <div
            className="space-y-2"
            onDrop={(e) => handleDrop(day.date, 'dinner', e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/5', 'rounded-lg');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/5', 'rounded-lg');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-violet-400" />
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Dinner
                </h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'dinner')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {dayMeals.dinner.length > 0 ? (
              dayMeals.dinner.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setAdjustedServings(null);
                    setViewDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  onCopy={() => handleCopyMeal(meal)}
                  onMove={() => handleMoveMeal(meal)}
                  onSwap={() => handleSwapMeal(meal)}
                />
              ))
            ) : (
              <SmartDropZone
                mealType="dinner"
                dayOfWeek={day.dayName}
                date={day.date}
                onAdd={() => handleAddMeal(day.date, 'dinner')}
                onSelectSuggestion={(mealId) => handleQuickAddSuggestion(mealId, day.date, 'dinner')}
                availableMeals={meals}
                weekPlan={weekPlan}
                onDrop={handleDrop}
              />
            )}
          </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Recipe Browser - Integrated Side Panel (hidden on mobile) */}
      {recipeBrowserOpen && (
        <div data-tour-id="recipe-sidebar" className="hidden lg:block w-80 xl:w-96 relative self-stretch border-r border-border bg-background flex-shrink-0">
          <RecipeBrowserSidebar
            meals={meals}
            isOpen={recipeBrowserOpen}
            onClose={() => setRecipeBrowserOpen(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 h-full overflow-y-auto bg-slate-50">
        <div className="max-w-[2000px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Top Row: Title + Week Navigation + Primary Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              {/* Title & Date */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Weekly Meal Plan
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs sm:text-sm text-slate-600">
                    {format(parseISO(currentWeekStart), 'MMM d')} – {format(addDays(parseISO(currentWeekStart), 6), 'MMM d, yyyy')}
                  </p>
                  {/* Week completion indicator */}
                  {weeklyStats.totalMeals > 0 && (
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100">
                        <div className="flex gap-0.5">
                          {[...Array(7)].map((_, i) => {
                            const dayDate = format(addDays(parseISO(currentWeekStart), i), 'yyyy-MM-dd');
                            const dayHasMeals = mealsByDate[dayDate] && Object.values(mealsByDate[dayDate]).some(meals => (meals as any[]).length > 0);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-colors",
                                  dayHasMeals ? "bg-green-500" : "bg-slate-300"
                                )}
                              />
                            );
                          })}
                        </div>
                        <span className="text-slate-600 font-medium">
                          {weeklyStats.plannedDays}/7 days
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Week Navigation */}
              <div data-tour-id="week-navigation" className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousWeek}
                  className="h-9 w-9 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={goToThisWeek}
                  className="h-9 px-4 text-sm font-medium hover:bg-slate-100"
                >
                  This Week
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextWeek}
                  className="h-9 w-9 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              {/* Left: View Controls */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1">
                <Button
                  data-tour-id="recipe-sidebar-toggle"
                  variant={recipeBrowserOpen ? "default" : "outline"}
                  onClick={() => setRecipeBrowserOpen(!recipeBrowserOpen)}
                  size="sm"
                  className={cn(
                    "h-9 min-h-[36px] hidden lg:flex gap-1.5",
                    recipeBrowserOpen && "shadow-sm"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Recipes
                </Button>

                {/* Meal Display Toggle */}
                <div data-tour-id="meal-display-toggle" className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm flex-shrink-0">
                  <Button
                    variant={mealDisplayMode === 'dinners' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-xs min-h-[32px] rounded-r-none",
                      mealDisplayMode === 'dinners' && "shadow-sm"
                    )}
                    onClick={() => setMealDisplayMode('dinners')}
                  >
                    Dinners
                  </Button>
                  <Button
                    variant={mealDisplayMode === '3-meals' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-xs min-h-[32px] rounded-none border-x border-slate-100",
                      mealDisplayMode === '3-meals' && "shadow-sm"
                    )}
                    onClick={() => setMealDisplayMode('3-meals')}
                  >
                    3 Meals
                  </Button>
                  <Button
                    variant={mealDisplayMode === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-xs min-h-[32px] rounded-l-none",
                      mealDisplayMode === 'all' && "shadow-sm"
                    )}
                    onClick={() => setMealDisplayMode('all')}
                  >
                    All
                  </Button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm flex-shrink-0">
                  <Button
                    variant={viewMode === 'compact' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 min-h-[32px] rounded-r-none",
                      viewMode === 'compact' && "shadow-sm"
                    )}
                    onClick={() => setViewMode('compact')}
                    title="Compact View"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 min-h-[32px] rounded-l-none",
                      viewMode === 'week' && "shadow-sm"
                    )}
                    onClick={() => setViewMode('week')}
                    title="Grid View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
                <Button
                  data-tour-id="generate-button"
                  onClick={handleGenerateWeek}
                  disabled={generateWeekPlan.isPending}
                  size="sm"
                  className="h-9 min-h-[36px] flex-shrink-0 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{generateWeekPlan.isPending ? 'Generating...' : 'Generate'}</span>
                </Button>
                <Button
                  data-tour-id="shopping-button"
                  variant="outline"
                  onClick={handleGenerateShoppingList}
                  disabled={generateShoppingList.isPending}
                  size="sm"
                  className="h-9 min-h-[36px] flex-shrink-0 gap-1.5 shadow-sm hover:bg-slate-50"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{generateShoppingList.isPending ? 'Loading...' : 'Shop'}</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClearWeek}
                  disabled={!weekPlan || weekPlan.length === 0 || clearWeekPlan.isPending}
                  size="sm"
                  className="h-9 min-h-[36px] flex-shrink-0 gap-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{clearWeekPlan.isPending ? 'Clearing...' : 'Clear'}</span>
                </Button>
              </div>
            </div>
          </div>


          {/* Weekly Grid / List / Compact View */}
          {(() => {
            if (viewMode === 'compact') {
              return (
                <div data-tour-id="week-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                        setAdjustedServings(null);
                        setViewDialogOpen(true);
                      }}
                      onMealDelete={handleDeleteMeal}
                      mealDisplayMode={mealDisplayMode}
                    />
                  ))}
                </div>
              );
            } else if (viewMode === 'week') {
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                  {weekDays.map(day => renderDayCard(day))}
                </div>
              );
            } else if (viewMode === 'list') {
              return (
                <div className="space-y-4">
                  {weekDays.map(day => renderDayCard(day))}
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

          {/* Serving Adjustment Controls */}
          {selectedMeal?.servings && selectedMeal.servings > 0 && (
            <div className="bg-muted/30 p-4 rounded-lg border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Adjust Portions:</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const current = adjustedServings || selectedMeal.servings!;
                      const newValue = Math.max(1, current - 1);
                      setAdjustedServings(newValue);
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-[120px]">
                    <div className="text-2xl font-bold">
                      {adjustedServings || selectedMeal.servings}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {adjustedServings && adjustedServings !== selectedMeal.servings
                        ? `(original: ${selectedMeal.servings})`
                        : 'servings'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const current = adjustedServings || selectedMeal.servings!;
                      setAdjustedServings(current + 1);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {adjustedServings && adjustedServings !== selectedMeal.servings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdjustedServings(null)}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}
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
                <h3 className="font-semibold mb-2">
                  Ingredients
                  {adjustedServings && adjustedServings !== selectedMeal.servings && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (scaled for {adjustedServings} servings)
                    </span>
                  )}
                </h3>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {adjustedServings && selectedMeal.servings && adjustedServings !== selectedMeal.servings
                      ? scaleIngredients(
                          selectedMeal.ingredients,
                          calculateServingMultiplier(selectedMeal.servings, adjustedServings)
                        )
                      : selectedMeal.ingredients}
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

      {/* Delete Meal Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteMeal}
        title="Remove Meal"
        description="Are you sure you want to remove this meal from your plan?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Clear Week Confirmation Dialog */}
      <ConfirmDialog
        open={clearWeekConfirmOpen}
        onOpenChange={setClearWeekConfirmOpen}
        onConfirm={confirmClearWeek}
        title="Clear Entire Week"
        description={`Are you sure you want to clear all ${weekPlan?.length || 0} meals from this week? This action cannot be undone.`}
        confirmText="Clear Week"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Onboarding Tour for first-time users */}
      <OnboardingTour
        tourKey="plan-page-enhanced"
        steps={[
          {
            id: "welcome",
            target: "[data-tour-id='week-grid']",
            title: "Welcome to Your Meal Planner!",
            content: "This is your weekly meal plan. Each card represents a day with slots for breakfast, lunch, and dinner. Let's show you around!",
            position: "top"
          },
          {
            id: "recipe-sidebar",
            target: "[data-tour-id='recipe-sidebar']",
            title: "Your Recipe Collection",
            content: "Browse all your saved recipes here. You can drag and drop any recipe directly onto a meal slot to plan it for that day.",
            position: "right"
          },
          {
            id: "meal-display",
            target: "[data-tour-id='meal-display-toggle']",
            title: "Customize Your View",
            content: "Toggle between showing just dinners, 3 meals (breakfast, lunch, dinner), or all meals including snacks.",
            position: "bottom"
          },
          {
            id: "week-nav",
            target: "[data-tour-id='week-navigation']",
            title: "Navigate Between Weeks",
            content: "Use these arrows to move between weeks, or click 'This Week' to jump back to the current week.",
            position: "bottom"
          },
          {
            id: "generate",
            target: "[data-tour-id='generate-button']",
            title: "Auto-Generate Meal Plans",
            content: "Click Generate to automatically fill your week with meals from your recipe collection. It avoids duplicates and balances cuisines!",
            position: "bottom"
          },
          {
            id: "shopping",
            target: "[data-tour-id='shopping-button']",
            title: "Create Shopping Lists",
            content: "Once your week is planned, click Shop to generate a shopping list with all the ingredients you'll need, organized by category.",
            position: "bottom"
          }
        ]}
      />
        </div>
      </div>
    </div>
  );
};

export default PlanPageEnhanced;
