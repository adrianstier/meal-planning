import React, { useState, useMemo } from 'react';
import { Search, X, Clock, Baby, ChefHat } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { useDragDrop } from '../../../contexts/DragDropContext';
import { getCuisineEmoji } from '../../../utils/cuisineColors';
import type { Meal } from '../../../types/api';

interface RecipeBrowserSidebarProps {
  meals: Meal[] | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const RecipeBrowserSidebar: React.FC<RecipeBrowserSidebarProps> = ({ meals, isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { setDraggedRecipe } = useDragDrop();

  // Filter meals based on search and tags
  const filteredMeals = useMemo(() => {
    if (!meals) return [];

    // DEDUP FIX: Remove duplicate meal entries by ID
    const uniqueMeals = Array.from(
      new Map(meals.map(meal => [meal.id, meal])).values()
    );

    return uniqueMeals.filter(meal => {
      const matchesSearch = searchQuery === '' ||
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.cuisine?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(tag => meal.tags?.toLowerCase().includes(tag.toLowerCase()));

      return matchesSearch && matchesTags;
    });
  }, [meals, searchQuery, selectedTags]);

  // Get unique tags
  const availableTags = useMemo(() => {
    if (!meals) return [];
    const tags = new Set<string>();
    meals.forEach(meal => {
      if (meal.tags) {
        meal.tags.split(',').forEach(tag => tags.add(tag.trim()));
      }
    });
    return Array.from(tags).sort();
  }, [meals]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold mb-1">Recipe Browser</h2>
            <p className="text-sm text-muted-foreground">
              {filteredMeals.length} {filteredMeals.length === 1 ? 'recipe' : 'recipes'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 text-sm bg-muted/40 border-border focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {filteredMeals.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 px-4">
            <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="font-semibold mb-1">No recipes found</p>
            <p className="text-sm mb-4">Try adjusting your search or filters</p>
            {(searchQuery || selectedTags.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTags([]);
                }}
                className="mt-2"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredMeals.map(meal => {
              const isQuick = meal.cook_time_minutes && meal.cook_time_minutes <= 30;
              const isKidFriendly = meal.tags?.toLowerCase().includes('kid-friendly');

              return (
                <div
                  key={meal.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedRecipe({ meal, sourceType: 'recipes' });
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/json', JSON.stringify(meal));
                  }}
                  onDragEnd={() => {
                    setDraggedRecipe(null);
                  }}
                  className="group relative p-3.5 rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
                  <div className="space-y-2">
                    {/* Cuisine + Title */}
                    <div className="space-y-1">
                      {meal.cuisine && (
                        <div className="text-xs font-medium text-muted-foreground">
                          {getCuisineEmoji(meal.cuisine)} {meal.cuisine}
                        </div>
                      )}
                      <h3 className="text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {meal.name}
                      </h3>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                      {meal.cook_time_minutes && (
                        <div className={`flex items-center gap-1 ${isQuick ? 'text-orange-600 font-medium' : ''}`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span>{meal.cook_time_minutes}m</span>
                        </div>
                      )}
                      {isKidFriendly && (
                        <div className="flex items-center gap-1 text-blue-600 font-medium">
                          <Baby className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {meal.servings && (
                        <span>{meal.servings} servings</span>
                      )}
                    </div>
                  </div>

                  {/* Drag hint overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer tip */}
      <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          <span className="font-semibold">💡 Tip:</span> Drag recipes to add them to your plan
        </p>
      </div>
    </div>
  );
};

export default RecipeBrowserSidebar;
