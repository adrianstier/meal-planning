import React, { useState } from 'react';
import { Plus, Heart, Sparkles, Trash2, Pencil, Link, ChevronDown, Search, Clock, Baby, Package, Utensils, ArrowUpDown, ChefHat, Zap, AlertCircle, Tags, ExternalLink, ThumbsUp, Camera, CheckSquare, X, Coffee, Salad, UtensilsCrossed, Apple, Globe, Brain, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { RecipeParsingProgress } from '../components/features/recipes/RecipeParsingProgress';
import { useMeals, useCreateMeal, useUpdateMeal, useToggleFavorite, useDeleteMeal, useParseRecipe, useParseRecipeFromImage, useBulkDeleteMeals, useParseRecipeFromUrlAI } from '../hooks/useMeals';
import type { Meal } from '../types/api';
import StarRating from '../components/StarRating';
import { useDragDrop } from '../contexts/DragDropContext';
import { useUndoToast } from '../components/ui/undo-toast';
import { cn } from '../lib/utils';

// Interface for parsed recipe data from AI/URL parsing
interface ParsedRecipeData {
  name?: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cook_time_minutes?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string;
  ingredients?: string | Array<{ quantity?: string; name: string }>;
  instructions?: string | string[];
  image_url?: string;
  source_url?: string;
  cuisine?: string;
}

const RecipesPage: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<Partial<Meal> | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [prepTimeFilter, setPrepTimeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [cuisineFilter, setCuisineFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMealIds, setSelectedMealIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Meal>>({
    name: '',
    meal_type: 'dinner',
    cook_time_minutes: undefined,
    servings: undefined,
    difficulty: 'medium',
    tags: '',
    ingredients: '',
    instructions: '',
    image_url: '',
  });

  const { data: meals, isLoading } = useMeals();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const toggleFavorite = useToggleFavorite();
  const deleteMeal = useDeleteMeal();
  const bulkDeleteMeals = useBulkDeleteMeals();
  const parseRecipe = useParseRecipe();
  const parseRecipeFromImage = useParseRecipeFromImage();
  const parseRecipeFromUrlAI = useParseRecipeFromUrlAI();
  const { setDraggedRecipe } = useDragDrop();
  const { showUndoToast } = useUndoToast();


  // Multi-select handlers
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setSelectedMealIds(new Set());
    }
  };

  const toggleMealSelection = (mealId: number) => {
    const newSelected = new Set(selectedMealIds);
    if (newSelected.has(mealId)) {
      newSelected.delete(mealId);
    } else {
      newSelected.add(mealId);
    }
    setSelectedMealIds(newSelected);
  };

  // selectAllInCurrentTab can be re-enabled when bulk selection UI is added
  // const selectAllInCurrentTab = (mealList: Meal[]) => {
  //   const newSelected = new Set(selectedMealIds);
  //   mealList.forEach(meal => newSelected.add(meal.id));
  //   setSelectedMealIds(newSelected);
  // };

  const deselectAll = () => {
    setSelectedMealIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedMealIds.size === 0) return;

    try {
      await bulkDeleteMeals.mutateAsync(Array.from(selectedMealIds));
      setBulkDeleteDialogOpen(false);
      setSelectedMealIds(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error('Failed to bulk delete meals:', error);
    }
  };

  const handleParseRecipe = async () => {
    try {
      const result = await parseRecipe.mutateAsync(recipeText);

      // The axios interceptor unwraps { success: true, data: {...} } to just {...}
      // So result.data is the parsed recipe object
      const parsedData = result.data;

      setParsedRecipe(parsedData);
      setParseDialogOpen(false);

      // Pre-fill form with parsed data
      // Convert ingredients array to formatted string
      let ingredientsText = '';
      if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
        ingredientsText = parsedData.ingredients
          .map((ing: { quantity?: string; name: string }) => {
            const quantity = ing.quantity ? `${ing.quantity} ` : '';
            const name = ing.name || '';
            return `${quantity}${name}`.trim();
          })
          .filter(line => line.length > 0)
          .join('\n');
      } else if (typeof parsedData.ingredients === 'string') {
        ingredientsText = parsedData.ingredients;
      }

      // Convert instructions if it's an array
      let instructionsText = '';
      if (parsedData.instructions && Array.isArray(parsedData.instructions)) {
        instructionsText = parsedData.instructions.join('\n');
      } else if (typeof parsedData.instructions === 'string') {
        instructionsText = parsedData.instructions;
      }

      setFormData({
        ...formData,
        name: parsedData.name || '',
        meal_type: parsedData.meal_type || 'dinner',
        cook_time_minutes: parsedData.cook_time_minutes,
        servings: parsedData.servings,
        difficulty: parsedData.difficulty || 'medium',
        tags: parsedData.tags || '',
        ingredients: ingredientsText,
        instructions: instructionsText,
        image_url: parsedData.image_url,
        source_url: parsedData.source_url,
        cuisine: parsedData.cuisine,
      });
      setAddDialogOpen(true);
      setRecipeText('');
    } catch (error) {
      console.error('Failed to parse recipe:', error);
      alert(`Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper to process parsed recipe data into form data
  const processParseResult = (parsedData: ParsedRecipeData) => {
    // Pre-fill form with parsed data
    let ingredientsText = '';
    if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
      ingredientsText = parsedData.ingredients
        .map((ing: { quantity?: string; name: string }) => {
          const quantity = ing.quantity ? `${ing.quantity} ` : '';
          const name = ing.name || '';
          return `${quantity}${name}`.trim();
        })
        .filter((line: string) => line.length > 0)
        .join('\n');
    } else if (typeof parsedData.ingredients === 'string') {
      ingredientsText = parsedData.ingredients;
    }

    let instructionsText = '';
    if (parsedData.instructions && Array.isArray(parsedData.instructions)) {
      instructionsText = parsedData.instructions.join('\n');
    } else if (typeof parsedData.instructions === 'string') {
      instructionsText = parsedData.instructions;
    }

    setFormData({
      ...formData,
      name: parsedData.name || '',
      meal_type: parsedData.meal_type || 'dinner',
      cook_time_minutes: parsedData.cook_time_minutes,
      servings: parsedData.servings,
      difficulty: parsedData.difficulty || 'medium',
      tags: parsedData.tags || '',
      ingredients: ingredientsText,
      instructions: instructionsText,
      image_url: parsedData.image_url,
      source_url: parsedData.source_url,
      cuisine: parsedData.cuisine,
    });
  };

  // AI-enhanced import - uses Claude to parse the page
  const handleParseFromUrlAI = async () => {
    if (!recipeUrl.trim()) {
      alert('Please enter a recipe URL');
      return;
    }

    try {
      const result = await parseRecipeFromUrlAI.mutateAsync(recipeUrl);
      const parsedData = result.data;

      setParsedRecipe(parsedData);
      setUrlDialogOpen(false);
      processParseResult(parsedData);
      setAddDialogOpen(true);
      setRecipeUrl('');
    } catch (error) {
      console.error('Failed to parse recipe from URL with AI:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to import recipe: ${errorMessage}`);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseFromImage = async () => {
    if (!selectedImage) {
      alert('Please select an image');
      return;
    }

    try {
      const result = await parseRecipeFromImage.mutateAsync(selectedImage);

      const parsedData = result.data;

      setParsedRecipe(parsedData);
      setImageDialogOpen(false);

      // Pre-fill form with parsed data (same logic as other parse handlers)
      let ingredientsText = '';
      if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
        ingredientsText = parsedData.ingredients
          .map((ing: { quantity?: string; name: string }) => {
            const quantity = ing.quantity ? `${ing.quantity} ` : '';
            const name = ing.name || '';
            return `${quantity}${name}`.trim();
          })
          .filter(line => line.length > 0)
          .join('\n');
      } else if (typeof parsedData.ingredients === 'string') {
        ingredientsText = parsedData.ingredients;
      }

      let instructionsText = '';
      if (parsedData.instructions && Array.isArray(parsedData.instructions)) {
        instructionsText = parsedData.instructions.join('\n');
      } else if (typeof parsedData.instructions === 'string') {
        instructionsText = parsedData.instructions;
      }

      const recipeToSave = {
        name: parsedData.name || 'Untitled Recipe',
        meal_type: parsedData.meal_type || 'dinner',
        cook_time_minutes: parsedData.cook_time_minutes,
        servings: parsedData.servings,
        difficulty: parsedData.difficulty || 'medium',
        tags: parsedData.tags || '',
        ingredients: ingredientsText,
        instructions: instructionsText,
        image_url: parsedData.image_url,
        cuisine: parsedData.cuisine,
      };

      // Auto-save the recipe to the database
      try {
        await createMeal.mutateAsync(recipeToSave);
        alert(`Recipe "${recipeToSave.name}" has been saved to your recipe book!`);
      } catch (saveError) {
        console.error('Failed to auto-save recipe:', saveError);
        // If auto-save fails, fall back to showing the form for manual save
        setFormData({
          ...formData,
          ...recipeToSave,
        });
        setAddDialogOpen(true);
        alert('Recipe parsed successfully! Please review and save manually.');
      }

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Failed to parse recipe from image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to parse recipe from image: ${errorMessage}`);
    }
  };

  const handleSubmit = async () => {
    try {
      if (isEditing && selectedMeal) {
        await updateMeal.mutateAsync({ id: selectedMeal.id, meal: formData });
      } else {
        await createMeal.mutateAsync(formData);
      }
      setAddDialogOpen(false);
      setFormData({
        name: '',
        meal_type: 'dinner',
        cook_time_minutes: undefined,
        servings: undefined,
        difficulty: 'medium',
        tags: '',
        ingredients: '',
        instructions: '',
        image_url: '',
      });
      setParsedRecipe(null);
      setIsEditing(false);
      setSelectedMeal(null);
    } catch (error) {
      console.error('Failed to save meal:', error);
    }
  };

  const handleToggleFavorite = async (meal: Meal) => {
    await toggleFavorite.mutateAsync({ id: meal.id, isFavorite: meal.is_favorite || false });
  };

  const handleRatingChange = async (meal: Meal, rating: number) => {
    await updateMeal.mutateAsync({
      id: meal.id,
      meal: { kid_rating: rating }
    });
  };

  const handleDeleteMeal = async () => {
    if (selectedMeal) {
      const mealToDelete = selectedMeal;

      await deleteMeal.mutateAsync(mealToDelete.id);
      setDeleteDialogOpen(false);
      setSelectedMeal(null);

      // Show undo toast with ability to restore
      showUndoToast({
        message: `"${mealToDelete.name}" deleted`,
        duration: 8000,
        undoFn: async () => {
          // Restore the meal by creating it again
          await createMeal.mutateAsync({
            name: mealToDelete.name,
            meal_type: mealToDelete.meal_type,
            cook_time_minutes: mealToDelete.cook_time_minutes,
            servings: mealToDelete.servings,
            difficulty: mealToDelete.difficulty,
            tags: mealToDelete.tags,
            ingredients: mealToDelete.ingredients,
            instructions: mealToDelete.instructions,
            image_url: mealToDelete.image_url,
            is_favorite: mealToDelete.is_favorite,
          });
        },
      });
    }
  };

  const handleBulkTag = async () => {
    if (!selectedMeal || !bulkTagInput.trim()) return;

    try {
      const existingTags = selectedMeal.tags || '';
      const newTags = bulkTagInput.trim();
      const combinedTags = existingTags
        ? `${existingTags}, ${newTags}`
        : newTags;

      await updateMeal.mutateAsync({
        id: selectedMeal.id,
        meal: { ...selectedMeal, tags: combinedTags }
      });

      setBulkTagDialogOpen(false);
      setBulkTagInput('');
      setSelectedMeal(null);
    } catch (error) {
      console.error('Failed to add tags:', error);
    }
  };

  // Filter helper functions
  const filterMeals = (mealList: Meal[]) => {
    return mealList.filter(meal => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        meal.name.toLowerCase().includes(searchLower) ||
        meal.ingredients?.toLowerCase().includes(searchLower) ||
        meal.tags?.toLowerCase().includes(searchLower);

      // Prep time filter
      const matchesPrepTime = prepTimeFilter === 'all' ||
        (meal.cook_time_minutes && meal.cook_time_minutes <= parseInt(prepTimeFilter));

      // Difficulty filter
      const matchesDifficulty = difficultyFilter === 'all' ||
        meal.difficulty === difficultyFilter;

      // Tag filter (includes kid favorites rating filter)
      let matchesTag = true;
      if (tagFilter === 'kid-favorites') {
        matchesTag = meal.kid_rating !== undefined && meal.kid_rating >= 4;
      } else if (tagFilter !== 'all') {
        matchesTag = meal.tags?.toLowerCase().includes(tagFilter.toLowerCase()) || false;
      }

      // Cuisine filter
      const matchesCuisine = cuisineFilter === 'all' ||
        meal.cuisine?.toLowerCase() === cuisineFilter.toLowerCase();

      return matchesSearch && matchesPrepTime && matchesDifficulty && matchesTag && matchesCuisine;
    });
  };

  // Helper to check if meal has specific tag
  const hasTag = (meal: Meal, tag: string) => {
    return meal.tags?.toLowerCase().includes(tag.toLowerCase());
  };

  // Helper to get difficulty icon
  const getDifficultyIcon = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy':
        return <Zap className="h-3.5 w-3.5 text-green-600" />;
      case 'medium':
        return <ChefHat className="h-3.5 w-3.5 text-yellow-600" />;
      case 'hard':
        return <AlertCircle className="h-3.5 w-3.5 text-red-600" />;
      default:
        return null;
    }
  };

  // Sort meals
  const sortMeals = (mealList: Meal[]) => {
    return [...mealList].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'prepTime':
          const timeA = a.cook_time_minutes || 999;
          const timeB = b.cook_time_minutes || 999;
          return timeA - timeB;
        case 'lastCooked':
          const dateA = a.last_cooked ? new Date(a.last_cooked).getTime() : 0;
          const dateB = b.last_cooked ? new Date(b.last_cooked).getTime() : 0;
          return dateB - dateA; // Most recent first
        case 'rating':
          const ratingA = a.kid_rating || 0;
          const ratingB = b.kid_rating || 0;
          return ratingB - ratingA; // Highest rating first
        default:
          return 0;
      }
    });
  };

  // Get unique cuisines for filter dropdown
  const uniqueCuisines = Array.from(
    new Set(meals?.map(m => m.cuisine).filter(Boolean) || [])
  ).sort();

  // Group meals by type, apply filters, and sort
  const mealsByType = {
    all: sortMeals(filterMeals(meals || [])),
    breakfast: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'breakfast') || [])),
    lunch: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'lunch') || [])),
    dinner: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'dinner') || [])),
    snack: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'snack') || [])),
    favorites: sortMeals(filterMeals(meals?.filter(m => m.is_favorite) || [])),
  };

  return (
    <div className="min-h-screen bg-gradient-warm p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto page-enter">
      {/* Header */}
      <Card className="shadow-sm border-border/50 bg-card rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">
                Recipe Collection
              </CardTitle>
              <CardDescription className="text-muted-foreground">{meals?.length || 0} recipes in your collection</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant={selectMode ? "default" : "outline"}
                onClick={toggleSelectMode}
                className={cn("btn-interactive", selectMode && "bg-primary hover:bg-primary/90")}
              >
                {selectMode ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Select
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="btn-accent-warm flex-1 sm:flex-initial">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Recipe
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setAddDialogOpen(true)} className="cursor-pointer transition-colors">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Manually
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setParseDialogOpen(true)} className="cursor-pointer transition-colors">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Parse from Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setUrlDialogOpen(true)} className="cursor-pointer transition-colors">
                    <Link className="mr-2 h-4 w-4" />
                    Parse from URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImageDialogOpen(true)} className="cursor-pointer transition-colors">
                    <Camera className="mr-2 h-4 w-4" />
                    Parse from Image
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recipes, ingredients, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-base transition-all duration-200 focus:shadow-md"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap sm:overflow-x-auto pb-2 sm:pb-0">
              <Select value={prepTimeFilter} onValueChange={setPrepTimeFilter}>
                <SelectTrigger className="w-full sm:w-[130px] h-11 min-h-[44px] transition-all duration-200 hover:shadow-sm">
                  <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All times</SelectItem>
                  <SelectItem value="15">≤15 min</SelectItem>
                  <SelectItem value="30">≤30 min</SelectItem>
                  <SelectItem value="60">≤60 min</SelectItem>
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-full sm:w-[130px] h-11 min-h-[44px] transition-all duration-200 hover:shadow-sm">
                  <ChefHat className="mr-1.5 h-4 w-4 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-11 min-h-[44px] transition-all duration-200 hover:shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recipes</SelectItem>
                  <SelectItem value="kid-favorites">Kid Favorites</SelectItem>
                  <SelectItem value="kid-friendly">Kid-friendly</SelectItem>
                  <SelectItem value="bento">Bento-friendly</SelectItem>
                  <SelectItem value="leftovers">Leftover-friendly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-11 min-h-[44px] transition-all duration-200 hover:shadow-sm">
                  <SelectValue placeholder="All cuisines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cuisines</SelectItem>
                  {uniqueCuisines.map((cuisine) => (
                    <SelectItem key={cuisine} value={cuisine?.toLowerCase() || ''}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[150px] h-11 min-h-[44px] transition-all duration-200 hover:shadow-sm col-span-2 sm:col-span-1">
                  <ArrowUpDown className="mr-1.5 h-4 w-4 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by name</SelectItem>
                  <SelectItem value="rating">Sort by rating</SelectItem>
                  <SelectItem value="prepTime">Sort by time</SelectItem>
                  <SelectItem value="lastCooked">Recently cooked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Recipes by Type */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start gap-1.5 h-auto p-1.5 bg-slate-100 rounded-xl">
          <TabsTrigger value="all" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <Globe className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">All</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.all.length})</span>
          </TabsTrigger>
          <TabsTrigger value="breakfast" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <Coffee className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Breakfast</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.breakfast.length})</span>
          </TabsTrigger>
          <TabsTrigger value="lunch" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <Salad className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Lunch</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.lunch.length})</span>
          </TabsTrigger>
          <TabsTrigger value="dinner" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <UtensilsCrossed className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Dinner</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.dinner.length})</span>
          </TabsTrigger>
          <TabsTrigger value="snack" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <Apple className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Snacks</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.snack.length})</span>
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex-1 min-w-[80px] sm:flex-initial sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">
            <Heart className="h-4 w-4 mr-1.5 fill-red-400 text-red-400" />
            <span className="hidden sm:inline">Favorites</span>
            <span className="ml-1 text-xs opacity-75">({mealsByType.favorites.length})</span>
          </TabsTrigger>
        </TabsList>

        {(['all', 'breakfast', 'lunch', 'dinner', 'snack', 'favorites'] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading recipes...
              </div>
            ) : mealsByType[type].length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {/* Check if filters are active */}
                {searchTerm || prepTimeFilter !== 'all' || difficultyFilter !== 'all' || tagFilter !== 'all' || cuisineFilter !== 'all' ? (
                  <>
                    <p className="text-lg font-medium mb-2">No recipes match your filters</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </>
                ) : type === 'favorites' ? (
                  'No favorite recipes yet. Click the heart icon on any recipe to add it to your favorites!'
                ) : type === 'all' ? (
                  'No recipes yet. Add one to get started!'
                ) : (
                  `No ${type} recipes yet. Add one to get started!`
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mealsByType[type].map((meal) => (
                  <Card
                    key={meal.id}
                    draggable={!selectMode}
                    onDragStart={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        return;
                      }
                      setDraggedRecipe({ meal, sourceType: 'recipes' });
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/json', JSON.stringify(meal));

                      // Create custom drag image with recipe preview
                      const dragPreview = document.createElement('div');
                      dragPreview.style.cssText = `
                        position: absolute;
                        top: -1000px;
                        width: 200px;
                        padding: 12px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                        font-family: system-ui;
                      `;

                      // Build drag preview using DOM methods to prevent XSS
                      const container = document.createElement('div');
                      container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

                      // Safely add image if URL is valid
                      if (meal.image_url && meal.image_url.startsWith('http')) {
                        const img = document.createElement('img');
                        img.src = meal.image_url;
                        img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 4px;';
                        container.appendChild(img);
                      }

                      // Use textContent to prevent XSS
                      const nameDiv = document.createElement('div');
                      nameDiv.style.cssText = 'font-weight: 600; font-size: 14px; color: #1f2937;';
                      nameDiv.textContent = meal.name;
                      container.appendChild(nameDiv);

                      const detailsDiv = document.createElement('div');
                      detailsDiv.style.cssText = 'font-size: 12px; color: #6b7280;';
                      detailsDiv.textContent = `${meal.cook_time_minutes || 30} min • ${meal.servings || 4} servings`;
                      container.appendChild(detailsDiv);

                      dragPreview.appendChild(container);

                      document.body.appendChild(dragPreview);
                      e.dataTransfer.setDragImage(dragPreview, 100, 50);
                      setTimeout(() => document.body.removeChild(dragPreview), 0);
                    }}
                    onDragEnd={() => {
                      setDraggedRecipe(null);
                    }}
                    className={`group flex flex-col ${selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden border-slate-200 bg-white rounded-xl ${selectMode && selectedMealIds.has(meal.id) ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}
                    onClick={() => {
                      if (selectMode) {
                        toggleMealSelection(meal.id);
                        return;
                      }
                      setSelectedMeal(meal);
                      setViewDialogOpen(true);
                    }}
                  >
                    <div className="aspect-video w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center relative">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // Hide broken image, show placeholder instead
                            e.currentTarget.style.display = 'none';
                            const placeholder = e.currentTarget.parentElement?.querySelector('.image-placeholder');
                            if (placeholder) placeholder.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`image-placeholder ${meal.image_url ? 'hidden' : ''} text-muted-foreground flex flex-col items-center justify-center p-4`}>
                        <svg className="w-16 h-16 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs opacity-60">No image</span>
                      </div>
                      {/* Selection checkbox in select mode */}
                      {selectMode && (
                        <div className="absolute top-2 left-2 z-20">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedMealIds.has(meal.id)
                              ? 'bg-teal-500 border-teal-500'
                              : 'bg-white/90 border-slate-300 backdrop-blur-sm'
                          }`}>
                            {selectedMealIds.has(meal.id) && (
                              <CheckSquare className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Floating favorite button */}
                      <button
                        className={`absolute top-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-200 hover:bg-white hover:scale-110 z-10 ${selectMode ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(meal);
                        }}
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            meal.is_favorite ? 'fill-red-500 text-red-500' : 'text-slate-600'
                          }`}
                        />
                      </button>
                      {/* Hover overlay for drag hint (only when not in select mode) */}
                      {!selectMode && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 pointer-events-none">
                        <span className="text-white text-sm font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
                          Drag to plan
                        </span>
                      </div>
                      )}
                    </div>
                    {meal.source_url && (
                      <div className="px-6 pt-3 pb-1">
                        <a
                          href={meal.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-all duration-200 hover:gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="font-medium">View Original Recipe</span>
                        </a>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{meal.name}</CardTitle>
                          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <StarRating
                              rating={meal.kid_rating || 0}
                              onChange={(rating) => handleRatingChange(meal, rating)}
                              size="sm"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(meal);
                          }}
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              meal.is_favorite ? 'fill-red-500 text-red-500' : ''
                            }`}
                          />
                        </Button>
                      </div>

                      {/* Visual Badges */}
                      <div className="flex flex-wrap gap-1.5 my-2">
                        {meal.cuisine && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800">
                            <Globe className="h-3 w-3 mr-1" />
                            {meal.cuisine}
                          </span>
                        )}
                        {hasTag(meal, 'kid-friendly') && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800">
                            <Baby className="h-3 w-3 mr-1" />
                            Kid-friendly
                          </span>
                        )}
                        {hasTag(meal, 'bento') && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
                            <Package className="h-3 w-3 mr-1" />
                            Bento
                          </span>
                        )}
                        {hasTag(meal, 'leftovers') && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800">
                            <Utensils className="h-3 w-3 mr-1" />
                            Leftovers
                          </span>
                        )}
                        {meal.cook_time_minutes && meal.cook_time_minutes <= 30 && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-orange-100 text-orange-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Quick
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 text-xs text-muted-foreground font-medium">
                        {meal.cook_time_minutes && (
                          <span>{meal.cook_time_minutes} min</span>
                        )}
                        {meal.difficulty && (
                          <span className="capitalize inline-flex items-center gap-1">
                            {getDifficultyIcon(meal.difficulty)}
                            {meal.difficulty}
                          </span>
                        )}
                        {meal.servings && <span>{meal.servings} servings</span>}
                      </div>
                      {meal.last_cooked && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last cooked: {new Date(meal.last_cooked).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: new Date(meal.last_cooked).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1">
                      {meal.tags && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {meal.tags.split(',').map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs rounded-full bg-secondary"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <div className="px-6 pb-4 flex gap-2 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({
                            name: meal.name,
                            meal_type: meal.meal_type,
                            cook_time_minutes: meal.cook_time_minutes,
                            servings: meal.servings,
                            difficulty: meal.difficulty,
                            tags: meal.tags || '',
                            ingredients: meal.ingredients || '',
                            instructions: meal.instructions || '',
                            image_url: meal.image_url || '',
                          });
                          setSelectedMeal(meal);
                          setIsEditing(true);
                          setAddDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeal(meal);
                          setBulkTagDialogOpen(true);
                        }}
                      >
                        <Tags className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeal(meal);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Parse Recipe Dialog */}
      <Dialog open={parseDialogOpen} onOpenChange={setParseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Parse Recipe from Text</DialogTitle>
            <DialogDescription>
              Paste a recipe and let AI extract the details for you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {parseRecipe.isPending ? (
              <RecipeParsingProgress
                isVisible={parseRecipe.isPending}
              />
            ) : (
              <Textarea
                placeholder="Paste your recipe here... Include the name, ingredients, and instructions."
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                className="min-h-[300px]"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParseDialogOpen(false)} disabled={parseRecipe.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleParseRecipe}
              disabled={!recipeText || parseRecipe.isPending}
            >
              {parseRecipe.isPending ? 'Parsing...' : 'Parse Recipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parse Recipe from URL Dialog */}
      <Dialog open={urlDialogOpen} onOpenChange={(open) => {
        setUrlDialogOpen(open);
        if (!open) {
          setRecipeUrl('');
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import Recipe from URL</DialogTitle>
            <DialogDescription>
              Paste a recipe URL and we'll extract the details automatically
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {parseRecipeFromUrlAI.isPending ? (
              <div className="py-8">
                <RecipeParsingProgress
                  isVisible={parseRecipeFromUrlAI.isPending}
                />
                <p className="text-center text-sm text-muted-foreground mt-4">
                  AI is analyzing the page... this may take a moment
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipe-url">Recipe URL</Label>
                  <Input
                    id="recipe-url"
                    type="url"
                    placeholder="https://example.com/recipe"
                    value={recipeUrl}
                    onChange={(e) => setRecipeUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && recipeUrl.trim()) {
                        handleParseFromUrlAI();
                      }
                    }}
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    <Brain className="h-3 w-3 inline mr-1 text-purple-500" />
                    Our AI will extract recipe details from any page (AllRecipes, FoodNetwork, blogs, etc.)
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUrlDialogOpen(false);
                setRecipeUrl('');
              }}
              disabled={parseRecipeFromUrlAI.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleParseFromUrlAI}
              disabled={!recipeUrl || parseRecipeFromUrlAI.isPending}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {parseRecipeFromUrlAI.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Import Recipe
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parse Recipe from Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={(open) => {
        setImageDialogOpen(open);
        if (!open) {
          setSelectedImage(null);
          setImagePreview(null);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Parse Recipe from Image</DialogTitle>
            <DialogDescription>
              Upload a photo of a recipe and let AI extract the details for you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {parseRecipeFromImage.isPending ? (
              <RecipeParsingProgress
                isVisible={parseRecipeFromImage.isPending}
              />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipe-image">Recipe Image</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="recipe-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageSelect}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
                {imagePreview && (
                  <div className="relative w-full">
                    <img
                      src={imagePreview}
                      alt="Recipe preview"
                      className="w-full max-h-64 object-contain rounded-lg border"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: JPEG, PNG, WebP, GIF
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImageDialogOpen(false);
              setSelectedImage(null);
              setImagePreview(null);
            }} disabled={parseRecipeFromImage.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleParseFromImage}
              disabled={!selectedImage || parseRecipeFromImage.isPending}
            >
              {parseRecipeFromImage.isPending ? 'Parsing...' : 'Parse Recipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Recipe Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setIsEditing(false);
          setSelectedMeal(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
            <DialogDescription>
              {parsedRecipe && 'Review and edit the parsed recipe details'}
              {!parsedRecipe && isEditing && 'Edit the recipe details'}
              {!parsedRecipe && !isEditing && 'Enter the recipe details manually'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Spaghetti Carbonara"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meal_type">Meal Type</Label>
                <Select
                  value={formData.meal_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      meal_type: value as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      difficulty: value as 'easy' | 'medium' | 'hard',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cook_time">Cook Time (minutes)</Label>
                <Input
                  id="cook_time"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.cook_time_minutes || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cook_time_minutes: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  max={50}
                  value={formData.servings || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                    // Clamp value between 1 and 50
                    const clampedValue = value ? Math.min(Math.max(value, 1), 50) : undefined;
                    setFormData({
                      ...formData,
                      servings: clampedValue,
                    });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., italian, pasta, quick"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL (optional)</Label>
              <Input
                id="image_url"
                value={formData.image_url || ''}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground">
                Paste a URL to an image of the recipe
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ingredients">Ingredients</Label>
              <Textarea
                id="ingredients"
                value={formData.ingredients}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                placeholder="List ingredients, one per line"
                className="min-h-[150px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Write the cooking instructions"
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMeal.isPending || updateMeal.isPending}
            >
              {isEditing
                ? (updateMeal.isPending ? 'Saving...' : 'Save Changes')
                : (createMeal.isPending ? 'Adding...' : 'Add Recipe')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Recipe Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMeal?.name}</DialogTitle>
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
            {/* Recipe Image */}
            {selectedMeal?.image_url && (
              <div className="aspect-video w-full overflow-hidden rounded-lg">
                <img
                  src={selectedMeal.image_url}
                  alt={selectedMeal.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Source URL */}
            {selectedMeal?.source_url && (
              <div>
                <a
                  href={selectedMeal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Original Recipe
                </a>
              </div>
            )}

            {/* Top Comments */}
            {selectedMeal?.top_comments && (() => {
              try {
                const comments = JSON.parse(selectedMeal.top_comments);
                if (comments && comments.length > 0) {
                  return (
                    <div>
                      <h3 className="font-semibold mb-3 text-lg">Top Comments from Original Recipe</h3>
                      <div className="space-y-3">
                        {comments.map((comment: { text: string; upvotes: number }, index: number) => (
                          <div key={index} className="bg-muted/50 p-4 rounded-lg border border-muted">
                            <p className="text-sm text-foreground leading-relaxed">{comment.text}</p>
                            {comment.upvotes > 0 && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span className="font-medium">{comment.upvotes} people found this helpful</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                return null;
              }
              return null;
            })()}

            {/* Kid Rating */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                Kid Rating
              </h3>
              {selectedMeal && (
                <StarRating
                  rating={selectedMeal.kid_rating || 0}
                  onChange={(rating) => handleRatingChange(selectedMeal, rating)}
                  size="lg"
                  showNumber={true}
                />
              )}
            </div>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedMeal?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMeal}
              disabled={deleteMeal.isPending}
            >
              {deleteMeal.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Dialog */}
      <Dialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tags to "{selectedMeal?.name}"</DialogTitle>
            <DialogDescription>
              Add tags like kid-friendly, bento, leftovers, etc. (comma-separated)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-tags">Current tags: {selectedMeal?.tags || 'none'}</Label>
              <Input
                id="bulk-tags"
                placeholder="e.g., kid-friendly, bento, quick"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBulkTag();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Quick tags: kid-friendly, bento, leftovers, quick, vegetarian, gluten-free
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkTag}
              disabled={!bulkTagInput.trim() || updateMeal.isPending}
            >
              {updateMeal.isPending ? 'Adding...' : 'Add Tags'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedMealIds.size} Recipes</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedMealIds.size} selected recipes? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMeals.isPending}
            >
              {bulkDeleteMeals.isPending ? 'Deleting...' : `Delete ${selectedMealIds.size} Recipes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Selection Action Bar */}
      {selectMode && selectedMealIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 px-4 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-slate-700">
            {selectedMealIds.size} selected
          </span>
          <div className="h-5 w-px bg-slate-200" />
          <Button
            variant="ghost"
            size="sm"
            onClick={deselectAll}
            className="text-slate-600"
          >
            Deselect All
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
            className="shadow-sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}
    </div>
  );
};

export default RecipesPage;
