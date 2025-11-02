import React, { useState } from 'react';
import { Plus, Heart, Sparkles, Trash2, Pencil } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useMeals, useCreateMeal, useUpdateMeal, useToggleFavorite, useDeleteMeal, useParseRecipe } from '../hooks/useMeals';
import type { Meal } from '../types/api';

const RecipesPage: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [parsedRecipe, setParsedRecipe] = useState<Partial<Meal> | null>(null);

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
      });
      setAddDialogOpen(true);
      setRecipeText('');
    } catch (error) {
      console.error('Failed to parse recipe:', error);
      alert(`Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleDeleteMeal = async () => {
    if (selectedMeal) {
      await deleteMeal.mutateAsync(selectedMeal.id);
      setDeleteDialogOpen(false);
      setSelectedMeal(null);
    }
  };

  // Group meals by type
  const mealsByType = {
    breakfast: meals?.filter(m => m.meal_type === 'breakfast') || [],
    lunch: meals?.filter(m => m.meal_type === 'lunch') || [],
    dinner: meals?.filter(m => m.meal_type === 'dinner') || [],
    snack: meals?.filter(m => m.meal_type === 'snack') || [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipes</CardTitle>
              <CardDescription>Manage your recipe collection</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setParseDialogOpen(true)} variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Parse with AI
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Recipe
              </Button>
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
                    className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedMeal(meal);
                      setViewDialogOpen(true);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{meal.name}</CardTitle>
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
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {meal.cook_time_minutes && (
                          <span>{meal.cook_time_minutes} min</span>
                        )}
                        {meal.difficulty && (
                          <span className="capitalize">{meal.difficulty}</span>
                        )}
                        {meal.servings && <span>{meal.servings} servings</span>}
                      </div>
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
                      {meal.last_cooked && (
                        <p className="text-xs text-muted-foreground">
                          Last cooked: {new Date(meal.last_cooked).toLocaleDateString()}
                        </p>
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
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
            <DialogTitle>Parse Recipe with AI</DialogTitle>
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
    </div>
  );
};

export default RecipesPage;
