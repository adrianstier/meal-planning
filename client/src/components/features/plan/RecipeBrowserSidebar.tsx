import React, { useState, useMemo } from 'react';
import { Search, X, Clock, Baby, ChefHat, GripVertical, Star, Filter } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { useDragDrop } from '../../../contexts/DragDropContext';
import { getCuisineEmoji } from '../../../utils/cuisineColors';
import { cn } from '../../../lib/utils';
import type { Meal } from '../../../types/api';

interface RecipeBrowserSidebarProps {
  meals: Meal[] | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const RecipeBrowserSidebar: React.FC<RecipeBrowserSidebarProps> = ({ meals, isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { setDraggedRecipe, draggedRecipe } = useDragDrop();

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

  // Get unique tags (limited to common ones)
  const availableTags = useMemo(() => {
    if (!meals) return [];
    const tagCounts = new Map<string, number>();
    meals.forEach(meal => {
      if (meal.tags) {
        meal.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
        });
      }
    });
    // Return top 8 most common tags
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [meals]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-200 flex-shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recipe Browser</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredMeals.length} recipe{filteredMeals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Drag instruction - prominent placement */}
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <GripVertical className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">Drag recipes to add to your plan</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 text-sm bg-white border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Filters */}
        {availableTags.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Filter className="h-3 w-3" />
              <span>{showFilters ? 'Hide filters' : 'Quick filters'}</span>
              {selectedTags.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-medium">
                  {selectedTags.length}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full transition-all",
                      selectedTags.includes(tag)
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {tag}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipe List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredMeals.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No recipes found</p>
            <p className="text-sm text-slate-500 mb-4">Try adjusting your search</p>
            {(searchQuery || selectedTags.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTags([]);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredMeals.map(meal => {
              const isQuick = meal.cook_time_minutes && meal.cook_time_minutes <= 30;
              const isKidFriendly = meal.tags?.toLowerCase().includes('kid-friendly');
              const isDragging = draggedRecipe?.meal.id === meal.id;

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
                  className={cn(
                    "group relative flex items-start gap-3 p-3 rounded-xl border bg-white cursor-grab active:cursor-grabbing transition-all duration-200",
                    isDragging
                      ? "opacity-50 border-primary bg-primary/5"
                      : "border-slate-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  {/* Drag handle */}
                  <div className="flex-shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="h-4 w-4 text-slate-300" />
                  </div>

                  {/* Cuisine emoji */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
                    {meal.cuisine ? getCuisineEmoji(meal.cuisine) : '🍽️'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                      {meal.name}
                    </h3>

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {meal.cook_time_minutes && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          isQuick ? "text-green-600" : "text-slate-500"
                        )}>
                          <Clock className="h-3 w-3" />
                          {meal.cook_time_minutes}m
                        </span>
                      )}
                      {meal.kid_rating && meal.kid_rating >= 4 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                          <Star className="h-3 w-3 fill-current" />
                          {meal.kid_rating}
                        </span>
                      )}
                      {isKidFriendly && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Baby className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50/50 flex-shrink-0">
        <p className="text-[11px] text-slate-400 text-center">
          {filteredMeals.length} of {meals?.length || 0} recipes shown
        </p>
      </div>
    </div>
  );
};

export default RecipeBrowserSidebar;
