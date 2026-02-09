import React, { useState } from 'react';
import { Sparkles, Search, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { useMeals } from '../../../hooks/useMeals';
import { useAddPlanItem, useSuggestMeal } from '../../../hooks/usePlan';
import type { Meal, PlanConstraints } from '../../../types/api';

interface AddMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  mealType: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'snack';
}

const AddMealDialog: React.FC<AddMealDialogProps> = ({
  open,
  onOpenChange,
  date,
  mealType,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [constraints, setConstraints] = useState<PlanConstraints>({
    max_cook_time: undefined,
    difficulty: undefined,
    avoid_recent_days: 7,
    prefer_favorites: false,
    use_leftovers: true,
  });

  const { data: meals, isLoading: mealsLoading } = useMeals();
  const addPlanItem = useAddPlanItem();
  const suggestMeal = useSuggestMeal();
  const [suggestions, setSuggestions] = useState<Meal[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Filter meals based on search query
  // Normalize snack types: morning_snack/afternoon_snack map to 'snack' meal_type
  const normalizedMealType = (mealType === 'morning_snack' || mealType === 'afternoon_snack') ? 'snack' : mealType;
  const filteredMeals = meals?.filter((meal) => {
    const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = meal.meal_type === normalizedMealType;
    return matchesSearch && matchesType;
  }) || [];

  const displayMeals = suggestions.length > 0 ? suggestions : filteredMeals;

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      // Map frontend meal types to backend types
      let backendMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      if (mealType === 'morning_snack' || mealType === 'afternoon_snack' || mealType === 'snack') {
        backendMealType = 'snack';
      } else {
        backendMealType = mealType as 'breakfast' | 'lunch' | 'dinner';
      }

      const result = await suggestMeal.mutateAsync({
        date,
        mealType: backendMealType,
        constraints,
      });
      setSuggestions(result.data || []);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddMeal = async () => {
    if (!selectedMealId) return;

    try {
      // Map frontend meal types to backend types
      let backendMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      if (mealType === 'morning_snack' || mealType === 'afternoon_snack' || mealType === 'snack') {
        backendMealType = 'snack';
      } else {
        backendMealType = mealType as 'breakfast' | 'lunch' | 'dinner';
      }

      await addPlanItem.mutateAsync({
        plan_date: date,
        meal_type: backendMealType,
        meal_id: selectedMealId,
      });
      onOpenChange(false);
      setSelectedMealId(null);
      setSearchQuery('');
      setSuggestions([]);
    } catch (error) {
      console.error('Failed to add meal:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Add {mealType === 'morning_snack' ? 'Morning Snack' : mealType === 'afternoon_snack' ? 'Afternoon Snack' : mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Select a meal for {(() => {
              // Parse date string as local timezone to avoid UTC midnight shift
              const [year, month, day] = date.split('-').map(Number);
              return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              });
            })()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Max Cook Time</Label>
              <Select
                value={constraints.max_cook_time?.toString() || 'any'}
                onValueChange={(value) =>
                  setConstraints({
                    ...constraints,
                    max_cook_time: value === 'any' ? undefined : parseInt(value),
                  })
                }
              >
                <SelectTrigger className="h-11 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="15">Under 15 min</SelectItem>
                  <SelectItem value="30">Under 30 min</SelectItem>
                  <SelectItem value="60">Under 1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={constraints.difficulty || 'any'}
                onValueChange={(value) =>
                  setConstraints({
                    ...constraints,
                    difficulty: value === 'any' ? undefined : value as 'easy' | 'medium' | 'hard',
                  })
                }
              >
                <SelectTrigger className="h-11 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any difficulty</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AI Suggestions Button */}
          <Button
            onClick={handleGetSuggestions}
            disabled={loadingSuggestions}
            className="w-full"
            variant="secondary"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingSuggestions ? 'Getting suggestions...' : 'Get AI Suggestions'}
          </Button>

          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Meals</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Meal List */}
          <div className="space-y-2">
            {mealsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading meals...
              </div>
            ) : displayMeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No meals found. Try adjusting your search or constraints.
              </div>
            ) : (
              <div className="grid gap-2 max-h-[50vh] sm:max-h-96 overflow-y-auto">
                {displayMeals.map((meal) => (
                  <button
                    key={meal.id}
                    onClick={() => setSelectedMealId(meal.id)}
                    className={`text-left p-4 rounded-md border transition-colors min-h-[52px] ${
                      selectedMealId === meal.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent active:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-base">{meal.name}</h4>
                        <div className="flex gap-2 mt-1 text-sm sm:text-xs text-muted-foreground">
                          {meal.cook_time_minutes && (
                            <span>{meal.cook_time_minutes} min</span>
                          )}
                          {meal.difficulty && (
                            <span className="capitalize">{meal.difficulty}</span>
                          )}
                          {meal.is_favorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddMeal} disabled={!selectedMealId || addPlanItem.isPending}>
            {addPlanItem.isPending ? 'Adding...' : 'Add Meal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealDialog;
