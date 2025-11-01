import React, { useState, useMemo } from 'react';
import { Search, Heart, Clock, ChefHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import { useMeals, useToggleFavorite } from '../hooks/useMeals';

const BrowsePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [maxCookTime, setMaxCookTime] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const { data: meals, isLoading } = useMeals();
  const toggleFavorite = useToggleFavorite();

  const filteredAndSortedMeals = useMemo(() => {
    if (!meals) return [];

    let filtered = meals.filter((meal) => {
      // Search filter
      const matchesSearch =
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.tags?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.ingredients?.toLowerCase().includes(searchQuery.toLowerCase());

      // Meal type filter
      const matchesType = mealTypeFilter === 'all' || meal.meal_type === mealTypeFilter;

      // Difficulty filter
      const matchesDifficulty =
        difficultyFilter === 'all' || meal.difficulty === difficultyFilter;

      // Cook time filter
      const matchesCookTime =
        maxCookTime === 'all' ||
        (meal.cook_time_minutes &&
          meal.cook_time_minutes <= parseInt(maxCookTime));

      return matchesSearch && matchesType && matchesDifficulty && matchesCookTime;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'cook_time':
          return (a.cook_time_minutes || 999) - (b.cook_time_minutes || 999);
        case 'recent':
          return (b.last_cooked || '').localeCompare(a.last_cooked || '');
        case 'favorites':
          return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [meals, searchQuery, mealTypeFilter, difficultyFilter, maxCookTime, sortBy]);

  const handleToggleFavorite = async (mealId: number, isFavorite: boolean) => {
    await toggleFavorite.mutateAsync({ id: mealId, isFavorite });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Browse Meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, tags, or ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Meal Type</Label>
              <Select value={mealTypeFilter} onValueChange={setMealTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Cook Time</Label>
              <Select value={maxCookTime} onValueChange={setMaxCookTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Time</SelectItem>
                  <SelectItem value="15">Under 15 min</SelectItem>
                  <SelectItem value="30">Under 30 min</SelectItem>
                  <SelectItem value="60">Under 1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="cook_time">Cook Time</SelectItem>
                  <SelectItem value="recent">Recently Cooked</SelectItem>
                  <SelectItem value="favorites">Favorites First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredAndSortedMeals.length} of {meals?.length || 0} meals
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading meals...</div>
      ) : filteredAndSortedMeals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No meals found. Try adjusting your filters.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedMeals.map((meal) => (
            <Card key={meal.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{meal.name}</CardTitle>
                    <span className="text-xs text-muted-foreground capitalize">
                      {meal.meal_type}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggleFavorite(meal.id, meal.is_favorite || false)}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        meal.is_favorite ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-sm">
                  {meal.cook_time_minutes && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {meal.cook_time_minutes} min
                    </div>
                  )}
                  {meal.difficulty && (
                    <div className="flex items-center gap-1 text-muted-foreground capitalize">
                      <ChefHat className="h-3.5 w-3.5" />
                      {meal.difficulty}
                    </div>
                  )}
                  {meal.servings && (
                    <div className="text-muted-foreground">{meal.servings} servings</div>
                  )}
                </div>

                {/* Tags */}
                {meal.tags && (
                  <div className="flex flex-wrap gap-1">
                    {meal.tags.split(',').map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs rounded-full bg-secondary"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Last cooked */}
                {meal.last_cooked && (
                  <p className="text-xs text-muted-foreground">
                    Last cooked: {new Date(meal.last_cooked).toLocaleDateString()}
                  </p>
                )}

                {/* Ingredients preview */}
                {meal.ingredients && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {meal.ingredients}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowsePage;
