import React, { useState } from 'react';
import { Clock, Baby, Package, Utensils, MoreVertical, Trash2, Copy, ArrowRight, Repeat } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { getCuisineEmoji } from '../../../utils/cuisineColors';
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
      className="group relative rounded border border-slate-200 bg-white hover:border-slate-300 cursor-pointer transition-colors overflow-hidden"
      onClick={onClick}
    >
      {/* Quick Delete Button - Simple X */}
      {onDelete && (
        <button
          className="absolute top-0.5 right-0.5 h-6 w-6 min-h-[24px] min-w-[24px] flex items-center justify-center rounded opacity-0 group-hover:opacity-100 sm:transition-opacity z-10 bg-white/95 shadow-sm hover:bg-red-50 hover:text-red-600 touch:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Remove from plan"
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Quick Actions Menu - only if there are other actions */}
      {(onCopy || onMove || onSwap) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/95 shadow-sm hover:bg-slate-50"
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
            {onDelete && <DropdownMenuSeparator />}
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

      <div className="pl-2 pr-7 py-1.5">
        {/* Meal Name - compact, single line */}
        <div className="text-xs font-medium text-slate-900 truncate">
          {meal.meal_name}
        </div>

        {/* Badges - very compact */}
        {renderBadges().length > 0 && (
          <div className="flex gap-1.5 mt-0.5">
            {renderBadges()}
          </div>
        )}
      </div>
    </div>
  );
};

export default MealCard;
