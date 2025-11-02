import React, { useState } from 'react';
import { Plus, Heart, Sparkles, Trash2, Pencil, Link, ChevronDown, Search, Clock, Baby, Package, Utensils, ArrowUpDown, ChefHat, Zap, AlertCircle, Tags, ExternalLink, ThumbsUp } from 'lucide-react';
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
import { useMeals, useCreateMeal, useUpdateMeal, useToggleFavorite, useDeleteMeal, useParseRecipe } from '../hooks/useMeals';
import type { Meal } from '../types/api';
import StarRating from '../components/StarRating';

const RecipesPage: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [parsedRecipe, setParsedRecipe] = useState<Partial<Meal> | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [prepTimeFilter, setPrepTimeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [cuisineFilter, setCuisineFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const [formData, setFormData] = useState<Partial<Meal>>({
    name: '',
    meal_type: 'dinner',
    cook_time_minutes: undefined,
    servings: undefined,
    difficulty: 'medium',
    tags: '',
    ingredients: '',
    instructions: '',
  });

  const { data: meals, isLoading } = useMeals();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const toggleFavorite = useToggleFavorite();
  const deleteMeal = useDeleteMeal();
  const parseRecipe = useParseRecipe();

  const handleParseRecipe = async () => {
    try {
      const result = await parseRecipe.mutateAsync(recipeText);

      // The axios interceptor unwraps { success: true, data: {...} } to just {...}
      // So result.data is the parsed recipe object
      const parsedData = result.data;
      console.log('Parsed recipe data:', parsedData);

      setParsedRecipe(parsedData);
      setParseDialogOpen(false);

      // Pre-fill form with parsed data
      // Convert ingredients array to formatted string
      let ingredientsText = '';
      if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
        ingredientsText = parsedData.ingredients
          .map((ing: any) => {
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

  const handleParseFromUrl = async () => {
    try {
      // For now, we'll just use the same parsing endpoint with the URL as text
      // The backend might need to be updated to fetch URL content
      const result = await parseRecipe.mutateAsync(recipeUrl);

      const parsedData = result.data;
      console.log('Parsed recipe data from URL:', parsedData);

      setParsedRecipe(parsedData);
      setUrlDialogOpen(false);

      // Pre-fill form with parsed data (same logic as handleParseRecipe)
      let ingredientsText = '';
      if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
        ingredientsText = parsedData.ingredients
          .map((ing: any) => {
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
      setRecipeUrl('');
    } catch (error) {
      console.error('Failed to parse recipe from URL:', error);
      alert(`Failed to parse recipe from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      await deleteMeal.mutateAsync(selectedMeal.id);
      setDeleteDialogOpen(false);
      setSelectedMeal(null);
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
        (prepTimeFilter === '30' && meal.cook_time_minutes && meal.cook_time_minutes <= 30);

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

      return matchesSearch && matchesPrepTime && matchesTag && matchesCuisine;
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
    breakfast: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'breakfast') || [])),
    lunch: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'lunch') || [])),
    dinner: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'dinner') || [])),
    snack: sortMeals(filterMeals(meals?.filter(m => m.meal_type === 'snack') || [])),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Recipes</CardTitle>
              <CardDescription>Manage your recipe collection</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipe
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setParseDialogOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Parse from Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUrlDialogOpen(true)}>
                  <Link className="mr-2 h-4 w-4" />
                  Parse from URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recipes, ingredients, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={prepTimeFilter} onValueChange={setPrepTimeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All times</SelectItem>
                  <SelectItem value="30">≤30 min</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recipes</SelectItem>
                  <SelectItem value="kid-favorites">Kid Favorites ⭐</SelectItem>
                  <SelectItem value="kid-friendly">Kid-friendly</SelectItem>
                  <SelectItem value="bento">Bento-friendly</SelectItem>
                  <SelectItem value="leftovers">Leftover-friendly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[160px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
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
      <Tabs defaultValue="dinner" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="breakfast">
            Breakfast ({mealsByType.breakfast.length})
          </TabsTrigger>
          <TabsTrigger value="lunch">
            Lunch ({mealsByType.lunch.length})
          </TabsTrigger>
          <TabsTrigger value="dinner">
            Dinner ({mealsByType.dinner.length})
          </TabsTrigger>
          <TabsTrigger value="snack">
            Snacks ({mealsByType.snack.length})
          </TabsTrigger>
        </TabsList>

        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading recipes...
              </div>
            ) : mealsByType[type].length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No {type} recipes yet. Add one to get started!
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mealsByType[type].map((meal) => (
                  <Card
                    key={meal.id}
                    className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => {
                      setSelectedMeal(meal);
                      setViewDialogOpen(true);
                    }}
                  >
                    {meal.image_url && (
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {meal.source_url && (
                      <div className="px-6 pt-3 pb-1">
                        <a
                          href={meal.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Original Recipe
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
                            🌍 {meal.cuisine}
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
            <Textarea
              placeholder="Paste your recipe here... Include the name, ingredients, and instructions."
              value={recipeText}
              onChange={(e) => setRecipeText(e.target.value)}
              className="min-h-[300px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParseDialogOpen(false)}>
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
      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Parse Recipe from URL</DialogTitle>
            <DialogDescription>
              Enter a recipe URL and let AI extract the details for you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipe-url">Recipe URL</Label>
              <Input
                id="recipe-url"
                type="url"
                placeholder="https://example.com/recipe"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleParseFromUrl}
              disabled={!recipeUrl || parseRecipe.isPending}
            >
              {parseRecipe.isPending ? 'Parsing...' : 'Parse Recipe'}
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
                  value={formData.servings || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      servings: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
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
                        {comments.map((comment: any, index: number) => (
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
    </div>
  );
};

export default RecipesPage;
