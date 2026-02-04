import React, { useEffect, useState, useCallback } from 'react';
import { Undo2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface UndoToastProps {
  /**
   * Message to display
   */
  message: string;
  /**
   * Duration before auto-dismiss in ms
   */
  duration?: number;
  /**
   * Callback when undo is clicked
   */
  onUndo: () => void | Promise<void>;
  /**
   * Callback when toast is dismissed (either by timeout or close)
   */
  onDismiss: () => void;
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * UndoToast component
 *
 * Displays a toast with an undo button for reversible destructive actions.
 * Auto-dismisses after duration, unless user clicks undo.
 *
 * UX Principles:
 * - Shows for longer duration (8s default) to give user time to undo
 * - Prominent undo button
 * - Progress indicator showing time remaining
 */
export const UndoToast: React.FC<UndoToastProps> = ({
  message,
  duration = 8000,
  onUndo,
  onDismiss,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isUndoing, setIsUndoing] = useState(false);
  const [progress, setProgress] = useState(100);

  // Progress bar animation
  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / duration) * 100;
      setProgress(newProgress);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    const animationId = requestAnimationFrame(updateProgress);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(), 200);
    }, duration);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationId);
    };
  }, [duration, onDismiss]);

  const handleUndo = useCallback(async () => {
    if (isUndoing) return;

    setIsUndoing(true);
    try {
      await onUndo();
      setIsVisible(false);
      setTimeout(() => onDismiss(), 200);
    } catch (error) {
      console.error('Undo failed:', error);
      setIsUndoing(false);
    }
  }, [onUndo, onDismiss, isUndoing]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onDismiss(), 200);
  }, [onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md',
        'animate-slide-in-from-bottom',
        isVisible ? 'opacity-100' : 'opacity-0',
        'transition-opacity duration-200',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:bg-slate-900 dark:border-slate-700">
        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 h-1 bg-amber-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-center gap-3 p-4 pt-5">
          <div className="flex-1">
            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
              {message}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={isUndoing}
            className="flex items-center gap-1.5 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {isUndoing ? 'Undoing...' : 'Undo'}
          </Button>

          <button
            onClick={handleClose}
            className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Context for managing undo toasts globally
interface UndoAction {
  id: string;
  message: string;
  undoFn: () => void | Promise<void>;
  duration?: number;
}

interface UndoToastContextType {
  showUndoToast: (action: Omit<UndoAction, 'id'>) => string;
  dismissUndoToast: (id: string) => void;
}

const UndoToastContext = React.createContext<UndoToastContextType | null>(null);

export const useUndoToast = () => {
  const context = React.useContext(UndoToastContext);
  if (!context) {
    throw new Error('useUndoToast must be used within UndoToastProvider');
  }
  return context;
};

export const UndoToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<UndoAction[]>([]);

  const showUndoToast = useCallback((action: Omit<UndoAction, 'id'>) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { ...action, id }]);
    return id;
  }, []);

  const dismissUndoToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <UndoToastContext.Provider value={{ showUndoToast, dismissUndoToast }}>
      {children}
      {/* Render only the most recent toast */}
      {toasts.length > 0 && (
        <UndoToast
          key={toasts[toasts.length - 1].id}
          message={toasts[toasts.length - 1].message}
          duration={toasts[toasts.length - 1].duration}
          onUndo={toasts[toasts.length - 1].undoFn}
          onDismiss={() => dismissUndoToast(toasts[toasts.length - 1].id)}
        />
      )}
    </UndoToastContext.Provider>
  );
};
