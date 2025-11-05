import React, { useState } from 'react';
import { Clock, Baby, Package, Utensils, MoreVertical, Trash2, Copy, ArrowRight, Repeat, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { getCuisineColors, getCuisineEmoji } from '../../../utils/cuisineColors';
import type { MealPlan } from '../../../types/api';

interface MealCardProps {
  meal: MealPlan;
  onClick: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onMove?: () => void;
  onSwap?: () => void;
}

const MealCard: React.FC<MealCardProps> = ({
  meal,
  onClick,
  onDelete,
  onCopy,
  onMove,
  onSwap,
}) => {
  const [imageError, setImageError] = useState(false);
  const cuisineColors = getCuisineColors(meal.cuisine);

  // Helper to check if meal has specific tag
  const hasTag = (tag: string) => {
    return meal.meal_tags?.toLowerCase().includes(tag.toLowerCase());
  };

  const renderBadges = () => {
    const badges = [];

    if (meal.cook_time_minutes && meal.cook_time_minutes <= 30) {
      badges.push(
        <span key="quick" className="inline-flex items-center text-xs text-orange-700">
          <Clock className="h-3 w-3 mr-0.5" />
          {meal.cook_time_minutes}m
        </span>
      );
    }

    if (hasTag('kid-friendly')) {
      badges.push(
        <span key="kid" className="inline-flex items-center text-xs text-blue-700">
          <Baby className="h-3 w-3" />
        </span>
      );
    }

    if (hasTag('bento')) {
      badges.push(
        <span key="bento" className="inline-flex items-center text-xs text-green-700">
          <Package className="h-3 w-3" />
        </span>
      );
    }

    if (hasTag('leftovers')) {
      badges.push(
        <span key="leftovers" className="inline-flex items-center text-xs text-purple-700">
          <Utensils className="h-3 w-3" />
        </span>
      );
    }

    return badges;
  };

  return (
    <div
      className={`group relative p-2 rounded-md ${cuisineColors.bg} border ${cuisineColors.border} hover:shadow-md cursor-pointer transition-all`}
      onClick={onClick}
    >
      {/* Quick Actions Menu */}
      {(onDelete || onCopy || onMove || onSwap) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onCopy && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to another day
              </DropdownMenuItem>
            )}
            {onMove && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                <ArrowRight className="mr-2 h-4 w-4" />
                Move to different slot
              </DropdownMenuItem>
            )}
            {onSwap && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSwap(); }}>
                <Repeat className="mr-2 h-4 w-4" />
                Swap with another meal
              </DropdownMenuItem>
            )}
            {(onDelete && (onCopy || onMove || onSwap)) && <DropdownMenuSeparator />}
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete from plan
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Meal Image (if available) */}
      {meal.image_url && !imageError && (
        <div className="w-full h-20 mb-2 rounded overflow-hidden bg-muted">
          <img
            src={meal.image_url}
            alt={meal.meal_name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )}

      {/* No image placeholder */}
      {(!meal.image_url || imageError) && (
        <div className="w-full h-16 mb-2 rounded bg-muted/30 flex items-center justify-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
        </div>
      )}

      {/* Meal Name */}
      <div className="font-medium text-sm mb-0.5 pr-6">{meal.meal_name}</div>

      {/* Cuisine Indicator */}
      {meal.cuisine && (
        <div className="text-xs text-muted-foreground mb-1">
          {getCuisineEmoji(meal.cuisine)} {meal.cuisine}
        </div>
      )}

      {/* Badges */}
      {renderBadges().length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {renderBadges()}
        </div>
      )}
    </div>
  );
};

export default MealCard;
