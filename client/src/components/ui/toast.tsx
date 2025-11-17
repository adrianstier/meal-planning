import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  /**
   * Type of toast notification
   */
  type: ToastType;
  /**
   * Toast message
   */
  message: string;
  /**
   * Optional description/details
   */
  description?: string;
  /**
   * Auto-dismiss duration in ms (0 = no auto-dismiss)
   */
  duration?: number;
  /**
   * Dismiss callback
   */
  onDismiss?: () => void;
  /**
   * Additional class names
   */
  className?: string;
}

const toastConfig: Record<ToastType, {
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-success/10',
    borderClass: 'border-success/20',
    textClass: 'text-success-foreground',
    iconClass: 'text-success',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/20',
    textClass: 'text-destructive-foreground',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: AlertCircle,
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/20',
    textClass: 'text-warning-foreground',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    bgClass: 'bg-info/10',
    borderClass: 'border-info/20',
    textClass: 'text-info-foreground',
    iconClass: 'text-info',
  },
};

/**
 * Toast component
 *
 * Displays temporary notification messages for user feedback.
 * Follows UX best practices for success/error messaging.
 *
 * UX Principles:
 * - Keep messages brief and positive (success states)
 * - Provide clear error explanations with next steps
 * - Auto-dismiss success messages (3-5s)
 * - Keep errors visible until user dismisses
 *
 * @example
 * <Toast
 *   type="success"
 *   message="Changes saved"
 *   duration={3000}
 *   onDismiss={handleDismiss}
 * />
 */
export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  description,
  duration = 5000,
  onDismiss,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 200); // Wait for exit animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-full max-w-sm',
        'animate-slide-in-from-bottom',
        isVisible ? 'opacity-100' : 'opacity-0',
        'transition-opacity duration-200',
        className
      )}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
          config.bgClass,
          config.borderClass
        )}
      >
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconClass)} aria-hidden="true" />

        <div className="flex-1 space-y-1">
          <p className={cn('font-medium text-sm', config.textClass)}>
            {message}
          </p>
          {description && (
            <p className={cn('text-sm opacity-90', config.textClass)}>
              {description}
            </p>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onDismiss(), 200);
            }}
            className={cn(
              'flex-shrink-0 rounded-md p-1 transition-colors',
              'hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-ring',
              config.textClass
            )}
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Toast Container component
 *
 * Manages multiple toast notifications with stacking
 */
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    message: string;
    description?: string;
    duration?: number;
  }>;
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{
            transform: `translateY(-${index * 8}px)`,
            transition: 'transform 200ms ease-out',
          }}
        >
          <Toast
            type={toast.type}
            message={toast.message}
            description={toast.description}
            duration={toast.duration}
            onDismiss={() => onDismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
