import React, { useState, useMemo, useEffect, useCallback, useRef, useReducer } from 'react';
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
  ChefHat,
  AlertCircle,
  Timer,
  Apple,
  Globe,
  StickyNote,
  Clock,
  Flame,
  Heart,
  ListChecks,
} from 'lucide-react';
import { scaleIngredients, calculateServingMultiplier } from '../utils/ingredientScaler';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
import RecipeBrowserSidebar from '../components/features/plan/RecipeBrowserSidebar';
import CompactDayCard from '../components/features/plan/CompactDayCard';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { OnboardingTour } from '../components/OnboardingTour';
import type { MealPlan } from '../types/api';

type ViewMode = 'week' | 'list' | 'compact';
type MealDisplayMode = 'dinners' | '3-meals' | 'all';

// Empty meals object to avoid re-renders from object creation in JSX
const EMPTY_MEALS: {
  breakfast: MealPlan[];
  morning_snack: MealPlan[];
  lunch: MealPlan[];
  afternoon_snack: MealPlan[];
  dinner: MealPlan[];
} = {
  breakfast: [],
  morning_snack: [],
  lunch: [],
  afternoon_snack: [],
  dinner: [],
};

// Type for generate week plan response with optional bento message
interface GenerateWeekPlanResponse {
  data: GeneratedPlanItem[];
  bentoMessage?: string;
}

// Generated plan item type (moved outside component for reuse)
interface GeneratedPlanItem {
  meal_id: number;
  date: string;
  meal_type: string;
  meal_name?: string;
  cuisine?: string;
  cook_time_minutes?: number;
  difficulty?: string;
}

// History action type for undo/redo functionality
interface HistoryAction {
  type: 'add' | 'delete' | 'move' | 'update';
  mealPlanId?: number;
  previousState?: MealPlan;
  newState?: MealPlan;
}

// Dialog state types for useReducer
interface DialogState {
  addMealOpen: boolean;
  viewMealOpen: boolean;
  generatePlanOpen: boolean;
  deleteConfirmOpen: boolean;
  clearWeekConfirmOpen: boolean;
}

type DialogAction =
  | { type: 'OPEN_ADD_MEAL' }
  | { type: 'CLOSE_ADD_MEAL' }
  | { type: 'OPEN_VIEW_MEAL' }
  | { type: 'CLOSE_VIEW_MEAL' }
  | { type: 'OPEN_GENERATE_PLAN' }
  | { type: 'CLOSE_GENERATE_PLAN' }
  | { type: 'OPEN_DELETE_CONFIRM' }
  | { type: 'CLOSE_DELETE_CONFIRM' }
  | { type: 'OPEN_CLEAR_WEEK_CONFIRM' }
  | { type: 'CLOSE_CLEAR_WEEK_CONFIRM' }
  | { type: 'CLOSE_ALL' };

const dialogInitialState: DialogState = {
  addMealOpen: false,
  viewMealOpen: false,
  generatePlanOpen: false,
  deleteConfirmOpen: false,
  clearWeekConfirmOpen: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN_ADD_MEAL':
      return { ...state, addMealOpen: true };
    case 'CLOSE_ADD_MEAL':
      return { ...state, addMealOpen: false };
    case 'OPEN_VIEW_MEAL':
      return { ...state, viewMealOpen: true };
    case 'CLOSE_VIEW_MEAL':
      return { ...state, viewMealOpen: false };
    case 'OPEN_GENERATE_PLAN':
      return { ...state, generatePlanOpen: true };
    case 'CLOSE_GENERATE_PLAN':
      return { ...state, generatePlanOpen: false };
    case 'OPEN_DELETE_CONFIRM':
      return { ...state, deleteConfirmOpen: true };
    case 'CLOSE_DELETE_CONFIRM':
      return { ...state, deleteConfirmOpen: false };
    case 'OPEN_CLEAR_WEEK_CONFIRM':
      return { ...state, clearWeekConfirmOpen: true };
    case 'CLOSE_CLEAR_WEEK_CONFIRM':
      return { ...state, clearWeekConfirmOpen: false };
    case 'CLOSE_ALL':
      return dialogInitialState;
    default:
      return state;
  }
}

// Meal selection state types for useReducer
type MealSlotType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';

interface MealSelectionState {
  selectedMeal: MealPlan | null;
  adjustedServings: number | null;
  selectedSlot: { date: string; mealType: MealSlotType } | null;
  pendingDeleteId: number | null;
  copiedMeal: MealPlan | null;
}

type MealSelectionAction =
  | { type: 'SELECT_MEAL'; meal: MealPlan }
  | { type: 'CLEAR_SELECTED_MEAL' }
  | { type: 'SET_ADJUSTED_SERVINGS'; servings: number | null }
  | { type: 'SELECT_SLOT'; date: string; mealType: MealSlotType }
  | { type: 'CLEAR_SELECTED_SLOT' }
  | { type: 'SET_PENDING_DELETE'; id: number }
  | { type: 'CLEAR_PENDING_DELETE' }
  | { type: 'COPY_MEAL'; meal: MealPlan }
  | { type: 'CLEAR_COPIED_MEAL' };

const mealSelectionInitialState: MealSelectionState = {
  selectedMeal: null,
  adjustedServings: null,
  selectedSlot: null,
  pendingDeleteId: null,
  copiedMeal: null,
};

function mealSelectionReducer(state: MealSelectionState, action: MealSelectionAction): MealSelectionState {
  switch (action.type) {
    case 'SELECT_MEAL':
      return { ...state, selectedMeal: action.meal, adjustedServings: null };
    case 'CLEAR_SELECTED_MEAL':
      return { ...state, selectedMeal: null, adjustedServings: null };
    case 'SET_ADJUSTED_SERVINGS':
      return { ...state, adjustedServings: action.servings };
    case 'SELECT_SLOT':
      return { ...state, selectedSlot: { date: action.date, mealType: action.mealType } };
    case 'CLEAR_SELECTED_SLOT':
      return { ...state, selectedSlot: null };
    case 'SET_PENDING_DELETE':
      return { ...state, pendingDeleteId: action.id };
    case 'CLEAR_PENDING_DELETE':
      return { ...state, pendingDeleteId: null };
    case 'COPY_MEAL':
      return { ...state, copiedMeal: action.meal };
    case 'CLEAR_COPIED_MEAL':
      return { ...state, copiedMeal: null };
    default:
      return state;
  }
}

const PlanPageEnhanced: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('planViewMode') as ViewMode) || 'compact';
  });

  const [mealDisplayMode, setMealDisplayMode] = useState<MealDisplayMode>('dinners');

  // Dialog state managed by reducer (reduces from 5 useState to 1 useReducer)
  const [dialogState, dispatchDialog] = useReducer(dialogReducer, dialogInitialState);

  // Meal selection state managed by reducer (reduces from 5 useState to 1 useReducer)
  const [mealSelection, dispatchMealSelection] = useReducer(mealSelectionReducer, mealSelectionInitialState);

  // Generation-related state
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanItem[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [generateBentos] = useState(false);
  const [bentoChildName] = useState('');
  const [recipeBrowserOpen, setRecipeBrowserOpen] = useState(true);

  // Undo/Redo state
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Navigation debounce to prevent race conditions when clicking rapidly
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  // Toast timeout ref to prevent memory leaks
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const handleDrop = useCallback(async (date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner', e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Drop event triggered:', { date, mealType, draggedRecipe });

    // Try to get meal from dataTransfer if draggedRecipe is null
    let mealToAdd = draggedRecipe?.meal;
    if (!mealToAdd) {
      try {
        const data = e.dataTransfer.getData('application/json');
        if (data) {
          mealToAdd = JSON.parse(data);
          console.log('Got meal from dataTransfer:', mealToAdd);
        }
      } catch (err) {
        console.error('Failed to parse drag data:', err);
      }
    }

    if (!mealToAdd) {
      console.warn('No meal to add - draggedRecipe is null and no dataTransfer data');
      return;
    }

    try {
      // Map frontend meal types to backend types (type-safe mapping)
      const mealTypeMap: Record<typeof mealType, 'breakfast' | 'lunch' | 'dinner' | 'snack'> = {
        'breakfast': 'breakfast',
        'morning_snack': 'snack',
        'lunch': 'lunch',
        'afternoon_snack': 'snack',
        'dinner': 'dinner'
      };
      const backendMealType = mealTypeMap[mealType];

      console.log('Adding to plan:', { meal_id: mealToAdd.id, plan_date: date, meal_type: backendMealType });

      await addPlanItem.mutateAsync({
        meal_id: mealToAdd.id,
        plan_date: date,
        meal_type: backendMealType,
      });

      console.log('Successfully added meal to plan!');
    } catch (error) {
      console.error('Failed to add meal to plan:', error);
    }
  }, [draggedRecipe, addPlanItem]);

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

  // Days with meals for compact view (reserved for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _daysWithMeals = useMemo(() => {
    return weekDays.filter(day =>
      mealsByDate[day.date] &&
      Object.values(mealsByDate[day.date]).some(meals => meals.length > 0)
    );
  }, [weekDays, mealsByDate]);

  // Refs to track current history state for callbacks without stale closures
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  // Undo/Redo functions using refs to avoid dependency on history/historyIndex
  const saveToHistory = useCallback((action: HistoryAction) => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(action);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, []);

  const handleUndo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex > 0) {
      // TODO: Implement undo logic based on action type
      // const _action = historyRef.current[currentIndex];
      setHistoryIndex(currentIndex - 1);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex < currentHistory.length - 1) {
      // TODO: Implement redo logic based on action type
      // const _action = currentHistory[currentIndex + 1];
      setHistoryIndex(currentIndex + 1);
    }
  }, []);

  // Toggle cuisine selection (reserved for future AI plan generation filters)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _toggleCuisine = useCallback((cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  }, []);

  // Debounced navigation to prevent race conditions when clicking rapidly
  const navigateToWeek = useCallback((newWeekStart: string) => {
    // Clear any pending navigation
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }

    // If already navigating, queue this navigation
    if (isNavigatingRef.current) {
      navigationTimeoutRef.current = setTimeout(() => {
        setCurrentWeekStart(newWeekStart);
      }, 150);
      return;
    }

    // Mark as navigating and set the new week
    isNavigatingRef.current = true;
    setCurrentWeekStart(newWeekStart);

    // Reset navigation lock after a short delay
    navigationTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  }, []);

  const goToPreviousWeek = useCallback(() => {
    const prevWeek = addDays(parseISO(currentWeekStart), -7);
    navigateToWeek(format(prevWeek, 'yyyy-MM-dd'));
  }, [currentWeekStart, navigateToWeek]);

  const goToNextWeek = useCallback(() => {
    const nextWeek = addDays(parseISO(currentWeekStart), 7);
    navigateToWeek(format(nextWeek, 'yyyy-MM-dd'));
  }, [currentWeekStart, navigateToWeek]);

  const goToThisWeek = useCallback(() => {
    const today = new Date();
    navigateToWeek(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
  }, [navigateToWeek]);

  // Cleanup navigation and toast timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleAddMeal = useCallback((date: string, mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner') => {
    dispatchMealSelection({ type: 'SELECT_SLOT', date, mealType });
    dispatchDialog({ type: 'OPEN_ADD_MEAL' });
  }, []);

  const handleDeleteMeal = useCallback((mealPlanId: number) => {
    dispatchMealSelection({ type: 'SET_PENDING_DELETE', id: mealPlanId });
    dispatchDialog({ type: 'OPEN_DELETE_CONFIRM' });
  }, []);

  const confirmDeleteMeal = useCallback(async () => {
    if (mealSelection.pendingDeleteId === null) return;

    try {
      await deletePlanItem.mutateAsync(mealSelection.pendingDeleteId);
      saveToHistory({ type: 'delete', mealPlanId: mealSelection.pendingDeleteId });
    } catch (error) {
      console.error('Failed to delete meal:', error);
    } finally {
      dispatchMealSelection({ type: 'CLEAR_PENDING_DELETE' });
    }
  }, [mealSelection.pendingDeleteId, deletePlanItem, saveToHistory]);

  const handleClearWeek = useCallback(() => {
    dispatchDialog({ type: 'OPEN_CLEAR_WEEK_CONFIRM' });
  }, []);

  const confirmClearWeek = useCallback(async () => {
    try {
      await clearWeekPlan.mutateAsync(currentWeekStart);
    } catch (error) {
      console.error('Failed to clear week:', error);
    }
  }, [clearWeekPlan, currentWeekStart]);

  const handleCopyMeal = useCallback((meal: MealPlan) => {
    dispatchMealSelection({ type: 'COPY_MEAL', meal });

    // Clear previous toast timeout to prevent memory leaks
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Remove any existing toast
    const existingToast = document.querySelector('[data-toast-copy-meal]');
    if (existingToast) {
      existingToast.remove();
    }

    // Show toast notification
    const toast = document.createElement('div');
    toast.setAttribute('data-toast-copy-meal', 'true');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-up';
    toast.textContent = 'Meal copied! Click any empty slot to paste.';
    document.body.appendChild(toast);

    toastTimeoutRef.current = setTimeout(() => {
      toast.remove();
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Paste copied meal to a slot (used by click-to-paste flow)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handlePasteMeal = useCallback(async (date: string, mealType: string) => {
    if (!mealSelection.copiedMeal) return;
    try {
      await addPlanItem.mutateAsync({
        meal_id: mealSelection.copiedMeal.meal_id,
        plan_date: date,
        meal_type: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack'
      });
      dispatchMealSelection({ type: 'CLEAR_COPIED_MEAL' });
    } catch (error) {
      console.error('Failed to paste meal:', error);
    }
  }, [mealSelection.copiedMeal, addPlanItem]);

  const handleMoveMeal = useCallback((_meal: MealPlan) => {
    // TODO: Show dialog to select target slot
    alert('Move meal feature - select a slot to move to');
  }, []);

  const handleSwapMeal = useCallback((_meal: MealPlan) => {
    // TODO: Show dialog to select meal to swap with
    alert('Swap meal feature - select another meal to swap with');
  }, []);

  // Handler for viewing a meal's details
  const handleViewMeal = useCallback((meal: MealPlan) => {
    dispatchMealSelection({ type: 'SELECT_MEAL', meal });
    dispatchDialog({ type: 'OPEN_VIEW_MEAL' });
  }, []);

  const handleQuickAddSuggestion = useCallback(async (mealId: number, date: string, mealType: string) => {
    try {
      await addPlanItem.mutateAsync({
        meal_id: mealId,
        plan_date: date,
        meal_type: mealType as "breakfast" | "lunch" | "dinner" | "snack",
      });
    } catch (error) {
      console.error('Failed to add suggested meal:', error);
    }
  }, [addPlanItem]);

  // Memoized drag event handlers to prevent new function creation on every render
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-primary/5', 'rounded-lg');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-primary/5', 'rounded-lg');
  }, []);

  const handleDragOverSnack = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-primary/10');
  }, []);

  const handleDragLeaveSnack = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-primary/10');
  }, []);

  // Enhanced badge renderer with better colors and icons (reserved for future UI enhancement)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderEnhancedBadges = (meal: MealPlan) => {
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

  const handleGenerateWeek = useCallback(async () => {
    try {
      const result = await generateWeekPlan.mutateAsync({
        startDate: currentWeekStart,
        numDays: 7,
        mealTypes: ['dinner'],
        avoidSchoolDuplicates: true,
        cuisines: selectedCuisines.length > 0 ? selectedCuisines : 'all',
        generateBentos: generateBentos,
        bentoChildName: bentoChildName
      }) as GenerateWeekPlanResponse;
      setGeneratedPlan(result.data);
      dispatchDialog({ type: 'OPEN_GENERATE_PLAN' });

      if (generateBentos && result.bentoMessage) {
        alert(result.bentoMessage);
      }
    } catch (error) {
      console.error('Failed to generate week plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate meal plan. Please try again.';
      alert(errorMessage);
    }
  }, [currentWeekStart, selectedCuisines, generateBentos, bentoChildName, generateWeekPlan]);

  // Keyboard shortcuts (placed after all handlers are defined)
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
  }, [goToPreviousWeek, goToNextWeek, goToThisWeek, handleGenerateWeek, handleUndo, handleRedo]);

  const handleApplyPlan = useCallback(async () => {
    try {
      await applyGeneratedPlan.mutateAsync(generatedPlan);
      dispatchDialog({ type: 'CLOSE_GENERATE_PLAN' });
      setGeneratedPlan([]);
    } catch (error) {
      console.error('Failed to apply plan:', error);
      alert('Failed to apply meal plan. Please try again.');
    }
  }, [applyGeneratedPlan, generatedPlan]);

  const handleGenerateShoppingList = useCallback(async () => {
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
  }, [currentWeekStart, generateShoppingList]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0">
        <div className="flex-1 h-full overflow-y-auto bg-gradient-warm">
          <div className="max-w-[2000px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Skeleton Header */}
            <div className="flex items-center justify-between">
              <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
              <div className="flex gap-2">
                <div className="skeleton-shimmer h-10 w-24 rounded-lg" />
                <div className="skeleton-shimmer h-10 w-32 rounded-lg" />
              </div>
            </div>
            {/* Skeleton Day Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl p-4 space-y-3 shadow-sm border border-border/50" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer h-11 w-11 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="skeleton-shimmer h-5 w-20 rounded" />
                      <div className="skeleton-shimmer h-3 w-12 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="skeleton-shimmer h-16 w-full rounded-lg" />
                    <div className="skeleton-shimmer h-16 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-muted-foreground animate-pulse">
              <ChefHat className="inline-block h-5 w-5 mr-2 text-primary" />
              Preparing your delicious week...
            </p>
          </div>
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
          "group flex flex-col bg-card rounded-xl transition-all duration-200 overflow-hidden card-hover",
          isTodayCard
            ? "ring-2 ring-primary ring-offset-2 shadow-lg"
            : isPastDay
            ? "opacity-60 hover:opacity-90"
            : "border border-border hover:border-primary/20"
        )}
      >
        {/* Day Header */}
        <div className={cn(
          "px-4 py-3",
          isTodayCard
            ? "bg-gradient-to-r from-primary/10 to-accent/5"
            : "bg-secondary/50"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Date circle */}
              <div className={cn(
                "w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all duration-200",
                isTodayCard
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border border-border"
              )}>
                <span className={cn(
                  "text-lg font-bold leading-none",
                  isTodayCard ? "text-primary-foreground" : "text-foreground"
                )}>
                  {day.dayNum}
                </span>
                <span className={cn(
                  "text-[10px] uppercase tracking-wide",
                  isTodayCard ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {day.month}
                </span>
              </div>
              <div>
                <h3 className={cn(
                  "text-base font-semibold",
                  isTodayCard ? "text-primary" : "text-foreground"
                )}>
                  {day.dayName}
                </h3>
                {isTodayCard && (
                  <span className="text-xs font-medium text-accent">
                    Today
                  </span>
                )}
              </div>
            </div>
            {/* Meal count indicator */}
            {mealsPlanned > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  mealsPlanned >= 3 ? "bg-primary" : mealsPlanned >= 1 ? "bg-accent" : "bg-muted"
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
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
                className="h-6 w-6 -mr-1 opacity-60 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'breakfast')}
                aria-label={`Add breakfast for ${day.dayName}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {dayMeals.breakfast.length > 0 ? (
              dayMeals.breakfast.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => handleViewMeal(meal)}
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
              onDragOver={handleDragOverSnack}
              onDragLeave={handleDragLeaveSnack}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-muted-foreground flex items-center gap-1"><Apple className="h-3 w-3" /> Morning Snack</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleAddMeal(day.date, 'morning_snack')}
                  aria-label={`Add morning snack for ${day.dayName}`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
              {dayMeals.morning_snack.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => handleViewMeal(meal)}
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
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
                className="h-6 w-6 -mr-1 opacity-60 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'lunch')}
                aria-label={`Add lunch for ${day.dayName}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {dayMeals.lunch.length > 0 ? (
              dayMeals.lunch.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => handleViewMeal(meal)}
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
              onDragOver={handleDragOverSnack}
              onDragLeave={handleDragLeaveSnack}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-muted-foreground flex items-center gap-1"><Apple className="h-3 w-3" /> Afternoon Snack</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleAddMeal(day.date, 'afternoon_snack')}
                  aria-label={`Add afternoon snack for ${day.dayName}`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
              {dayMeals.afternoon_snack.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => handleViewMeal(meal)}
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-teal-400" />
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Dinner
                </h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 opacity-60 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                onClick={() => handleAddMeal(day.date, 'dinner')}
                aria-label={`Add dinner for ${day.dayName}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {dayMeals.dinner.length > 0 ? (
              dayMeals.dinner.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => handleViewMeal(meal)}
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
      <div className="flex-1 h-full overflow-y-auto bg-gradient-warm">
        <div className="max-w-[2000px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 page-enter">

          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Top Row: Title + Week Navigation + Primary Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              {/* Title & Date */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Weekly Meal Plan
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {format(parseISO(currentWeekStart), 'MMM d')} – {format(addDays(parseISO(currentWeekStart), 6), 'MMM d, yyyy')}
                  </p>
                  {/* Week completion indicator */}
                  {weeklyStats.totalMeals > 0 && (
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary/80 border border-border/50">
                        <div className="flex gap-0.5">
                          {[...Array(7)].map((_, i) => {
                            const dayDate = format(addDays(parseISO(currentWeekStart), i), 'yyyy-MM-dd');
                            const dayHasMeals = mealsByDate[dayDate] && Object.values(mealsByDate[dayDate]).some(mealList => Array.isArray(mealList) && mealList.length > 0);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "w-2 h-2 rounded-full transition-all duration-200",
                                  dayHasMeals ? "bg-primary shadow-sm" : "bg-border"
                                )}
                              />
                            );
                          })}
                        </div>
                        <span className="text-foreground font-medium">
                          {weeklyStats.plannedDays}/7 days
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Week Navigation */}
              <div data-tour-id="week-navigation" className="flex items-center border border-border rounded-lg bg-card shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousWeek}
                  className="h-9 w-9 hover:bg-secondary btn-interactive"
                  aria-label="Go to previous week"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={goToThisWeek}
                  className="h-9 px-4 text-sm font-medium hover:bg-secondary btn-interactive"
                >
                  This Week
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextWeek}
                  className="h-9 w-9 hover:bg-secondary btn-interactive"
                  aria-label="Go to next week"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
                    aria-label="Switch to compact view"
                    aria-pressed={viewMode === 'compact'}
                  >
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 min-h-[32px] rounded-l-none",
                      viewMode === 'week' && "shadow-sm"
                    )}
                    onClick={() => setViewMode('week')}
                    aria-label="Switch to grid view"
                    aria-pressed={viewMode === 'week'}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
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
                  className="h-9 min-h-[36px] flex-shrink-0 gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-sm"
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
                      meals={(mealsByDate[day.date] as typeof EMPTY_MEALS) || EMPTY_MEALS}
                      onDrop={handleDrop}
                      onMealClick={handleViewMeal}
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
      <Dialog open={dialogState.viewMealOpen} onOpenChange={(open) => dispatchDialog({ type: open ? 'OPEN_VIEW_MEAL' : 'CLOSE_VIEW_MEAL' })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{mealSelection.selectedMeal?.meal_name}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap gap-3 text-sm mt-3">
                {mealSelection.selectedMeal?.cook_time_minutes && (
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <Clock className="h-3.5 w-3.5 text-orange-500" />
                    {mealSelection.selectedMeal.cook_time_minutes} min
                  </Badge>
                )}
                {mealSelection.selectedMeal?.difficulty && (
                  <Badge variant="outline" className="gap-1.5 font-normal capitalize">
                    <Flame className={cn(
                      "h-3.5 w-3.5",
                      mealSelection.selectedMeal.difficulty === 'easy' ? 'text-green-500' :
                      mealSelection.selectedMeal.difficulty === 'medium' ? 'text-amber-500' : 'text-red-500'
                    )} />
                    {mealSelection.selectedMeal.difficulty}
                  </Badge>
                )}
                {mealSelection.selectedMeal?.servings && (
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    {mealSelection.selectedMeal.servings} servings
                  </Badge>
                )}
                {mealSelection.selectedMeal?.cuisine && (
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <Globe className="h-3.5 w-3.5 text-purple-500" />
                    {mealSelection.selectedMeal.cuisine}
                  </Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Notes Section - Prominent display */}
          {mealSelection.selectedMeal?.notes && mealSelection.selectedMeal.notes.trim() && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <StickyNote className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Notes</h3>
                  <p className="text-amber-900 text-sm whitespace-pre-wrap">{mealSelection.selectedMeal.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Serving Adjustment Controls */}
          {mealSelection.selectedMeal?.servings && mealSelection.selectedMeal.servings > 0 && (
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
                      const current = mealSelection.adjustedServings || mealSelection.selectedMeal!.servings!;
                      const newValue = Math.max(1, current - 1);
                      dispatchMealSelection({ type: 'SET_ADJUSTED_SERVINGS', servings: newValue });
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-[120px]">
                    <div className="text-2xl font-bold">
                      {mealSelection.adjustedServings || mealSelection.selectedMeal.servings}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {mealSelection.adjustedServings && mealSelection.adjustedServings !== mealSelection.selectedMeal.servings
                        ? `(original: ${mealSelection.selectedMeal.servings})`
                        : 'servings'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const current = mealSelection.adjustedServings || mealSelection.selectedMeal!.servings!;
                      dispatchMealSelection({ type: 'SET_ADJUSTED_SERVINGS', servings: current + 1 });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {mealSelection.adjustedServings && mealSelection.adjustedServings !== mealSelection.selectedMeal.servings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatchMealSelection({ type: 'SET_ADJUSTED_SERVINGS', servings: null })}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {mealSelection.selectedMeal?.tags && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {mealSelection.selectedMeal.tags.split(',').map((tag, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="px-3 py-1"
                    >
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {mealSelection.selectedMeal?.ingredients && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-green-600" />
                  Ingredients
                  {mealSelection.adjustedServings && mealSelection.adjustedServings !== mealSelection.selectedMeal.servings && (
                    <span className="text-sm font-normal text-muted-foreground">
                      (scaled for {mealSelection.adjustedServings} servings)
                    </span>
                  )}
                </h3>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {mealSelection.adjustedServings && mealSelection.selectedMeal.servings && mealSelection.adjustedServings !== mealSelection.selectedMeal.servings
                      ? scaleIngredients(
                          mealSelection.selectedMeal.ingredients,
                          calculateServingMultiplier(mealSelection.selectedMeal.servings, mealSelection.adjustedServings)
                        )
                      : mealSelection.selectedMeal.ingredients}
                  </pre>
                </div>
              </div>
            )}

            {mealSelection.selectedMeal?.instructions && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-purple-600" />
                  Instructions
                </h3>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {mealSelection.selectedMeal.instructions}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => dispatchDialog({ type: 'CLOSE_VIEW_MEAL' })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog */}
      {mealSelection.selectedSlot && (
        <AddMealDialog
          open={dialogState.addMealOpen}
          onOpenChange={(open) => dispatchDialog({ type: open ? 'OPEN_ADD_MEAL' : 'CLOSE_ADD_MEAL' })}
          date={mealSelection.selectedSlot.date}
          mealType={mealSelection.selectedSlot.mealType}
        />
      )}

      {/* Generated Plan Dialog */}
      <Dialog open={dialogState.generatePlanOpen} onOpenChange={(open) => dispatchDialog({ type: open ? 'OPEN_GENERATE_PLAN' : 'CLOSE_GENERATE_PLAN' })}>
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
            <Button variant="outline" onClick={() => dispatchDialog({ type: 'CLOSE_GENERATE_PLAN' })}>
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
        open={dialogState.deleteConfirmOpen}
        onOpenChange={(open) => dispatchDialog({ type: open ? 'OPEN_DELETE_CONFIRM' : 'CLOSE_DELETE_CONFIRM' })}
        onConfirm={confirmDeleteMeal}
        title="Remove Meal"
        description="Are you sure you want to remove this meal from your plan?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Clear Week Confirmation Dialog */}
      <ConfirmDialog
        open={dialogState.clearWeekConfirmOpen}
        onOpenChange={(open) => dispatchDialog({ type: open ? 'OPEN_CLEAR_WEEK_CONFIRM' : 'CLOSE_CLEAR_WEEK_CONFIRM' })}
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
