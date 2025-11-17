import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  /**
   * Optional message to display below the spinner
   */
  message?: string;
  /**
   * Size variant of the loading spinner
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether to display as full-screen loading
   */
  fullScreen?: boolean;
  /**
   * Additional class names
   */
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

/**
 * LoadingState component
 *
 * Displays a loading spinner with optional message.
 * Use for async operations and data fetching states.
 *
 * @example
 * <LoadingState message="Loading your meals..." />
 * <LoadingState size="lg" fullScreen />
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  fullScreen = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-[400px] p-12' : 'p-8',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={cn(
          'animate-spin text-primary',
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
      {message && (
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton component for loading placeholders
 *
 * Use skeleton screens instead of spinners when loading content
 * to reduce perceived loading time and layout shift.
 *
 * @example
 * <Skeleton className="h-4 w-3/4" />
 * <Skeleton className="h-32 w-full rounded-lg" />
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
      aria-hidden="true"
    />
  );
};

/**
 * Card Skeleton for loading card layouts
 */
export const CardSkeleton: React.FC = () => {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
};

/**
 * List Skeleton for loading list layouts
 */
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};
