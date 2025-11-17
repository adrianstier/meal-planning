import React from 'react';
import { AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
  /**
   * Error title (user-friendly)
   */
  title?: string;
  /**
   * Error message with explanation
   */
  message?: string;
  /**
   * Retry callback function
   */
  onRetry?: () => void;
  /**
   * Variant of error display
   */
  variant?: 'inline' | 'page' | 'card';
  /**
   * Custom icon
   */
  icon?: React.ReactNode;
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * ErrorState component
 *
 * Displays error states with clear messaging and actionable next steps.
 * Always provide context about what went wrong and how to fix it.
 *
 * @example
 * <ErrorState
 *   title="Failed to load meals"
 *   message="We couldn't fetch your meal plan. Please check your connection and try again."
 *   onRetry={refetch}
 * />
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  variant = 'page',
  icon,
  className,
}) => {
  const Icon = icon || (variant === 'inline' ? AlertCircle : XCircle);

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20',
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-destructive">
            {title}
          </p>
          <p className="text-sm text-destructive/80">
            {message}
          </p>
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="flex-shrink-0"
            aria-label="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-8 rounded-lg border bg-card text-center',
          className
        )}
        role="alert"
      >
        <XCircle className="w-10 h-10 text-destructive mb-4" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {message}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Page variant (default)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] p-12',
        className
      )}
      role="alert"
    >
      <XCircle className="w-12 h-12 text-destructive mb-4" aria-hidden="true" />
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {title}
      </h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} size="lg">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
};

/**
 * FormError component for inline form validation errors
 */
export const FormError: React.FC<{ message: string }> = ({ message }) => {
  return (
    <p className="text-sm text-destructive flex items-center gap-2 mt-1" role="alert">
      <AlertCircle className="w-4 h-4" aria-hidden="true" />
      {message}
    </p>
  );
};
