import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  /**
   * Title of empty state
   */
  title: string;
  /**
   * Description with helpful context
   */
  description: string;
  /**
   * Primary action button config
   */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /**
   * Secondary action button config
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * EmptyState component
 *
 * Displays when there's no content to show.
 * Always provide helpful context and a clear next action.
 *
 * UX Principles:
 * - Tell users what they can do (not just what's missing)
 * - Provide a clear call-to-action
 * - Use encouraging, motivating language
 *
 * @example
 * <EmptyState
 *   icon={<CalendarIcon />}
 *   title="No meals planned yet"
 *   description="Start planning your weekly meals to see them here."
 *   action={{
 *     label: "Add Your First Meal",
 *     onClick: handleAddMeal,
 *     icon: <PlusIcon />
 *   }}
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4 text-muted-foreground opacity-60">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, {
              // @ts-ignore - Safe to add className to icon elements
              className: 'w-12 h-12 sm:w-16 sm:h-16',
              'aria-hidden': 'true',
            } as any)
          : icon}
      </div>

      {/* Title */}
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-sm">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button onClick={action.onClick} size="lg">
              {action.icon && (
                <span className="mr-2" aria-hidden="true">
                  {action.icon}
                </span>
              )}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="lg"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * NoResults component for search/filter empty states
 */
interface NoResultsProps {
  query?: string;
  onClear?: () => void;
  suggestions?: string[];
  className?: string;
}

export const NoResults: React.FC<NoResultsProps> = ({
  query,
  onClear,
  suggestions,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        {query ? `No results found for "${query}"` : 'No results found'}
      </h3>

      <p className="text-muted-foreground mb-6 max-w-md">
        Try adjusting your search or filters to find what you're looking for.
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Try searching for:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-muted text-sm text-foreground"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      )}

      {onClear && (
        <Button onClick={onClear} variant="outline">
          Clear Filters
        </Button>
      )}
    </div>
  );
};
