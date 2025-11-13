import React, { useState, useMemo } from 'react';
import { Search, X, Clock, Baby, Image as ImageIcon } from 'lucide-react';
import { Card } from '../../ui/card';
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
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const { setDraggedRecipe } = useDragDrop();

  const handleImageError = (mealId: number) => {
    setImageErrors(prev => new Set(prev).add(mealId));
  };

  // Filter meals based on search and tags
  const filteredMeals = useMemo(() => {
    if (!meals) return [];

    // First, deduplicate meals by ID to prevent duplicates from showing
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

  return (
    <div
      className={`border-r border-border bg-background overflow-hidden flex flex-col h-full transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-0'
      }`}
      style={{ flexShrink: 0 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recipe Browser</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
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
            className="pl-9"
          />
        </div>

        {/* Tag filters */}
        {availableTags.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-2">Filter by tags:</div>
            <div className="flex flex-wrap gap-1">
              {availableTags.slice(0, 8).map(tag => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredMeals.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-2">
            <p className="text-sm">No recipes found</p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTags([]);
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
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
                  className="px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-muted rounded transition-colors"
                  title={`${meal.name}${meal.cuisine ? ` • ${meal.cuisine}` : ''}${isQuick ? ` • ${meal.cook_time_minutes}m` : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 truncate font-medium">{meal.name}</div>
                    {isQuick && (
                      <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
                    )}
                    {isKidFriendly && (
                      <Baby className="h-3 w-3 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  {meal.cuisine && (
                    <div className="text-xs text-muted-foreground truncate">
                      {getCuisineEmoji(meal.cuisine)} {meal.cuisine}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer tip */}
      <div className="p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Drag recipes onto any meal slot to add them to your plan
        </p>
      </div>
    </div>
  );
};

export default RecipeBrowserSidebar;
