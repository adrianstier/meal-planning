import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface TourStep {
  id: string;
  target: string; // CSS selector for element to highlight
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  tourKey: string; // Unique key for this tour (e.g., 'plan-page-tour')
  onComplete?: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIP_MARGIN = 12;
const TOOLTIP_WIDTH = 360;
const VIEWPORT_PADDING = 16;

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  tourKey,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    actualPosition: 'bottom'
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [validSteps, setValidSteps] = useState<number[]>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find all valid steps (those with existing target elements)
  const findValidSteps = useCallback(() => {
    const valid: number[] = [];
    steps.forEach((step, index) => {
      const element = document.querySelector(step.target);
      if (element && isElementVisible(element as HTMLElement)) {
        valid.push(index);
      }
    });
    return valid;
  }, [steps]);

  // Check if element is visible in DOM
  const isElementVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null;
  };

  // Calculate optimal tooltip position with viewport boundary detection
  const calculateTooltipPosition = useCallback((
    element: HTMLElement,
    preferredPosition: 'top' | 'bottom' | 'left' | 'right'
  ): TooltipPosition => {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;

    // Calculate available space in each direction
    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // Determine best position based on available space
    let actualPosition = preferredPosition;

    // Check if preferred position has enough space, otherwise find best alternative
    const neededSpace = actualPosition === 'top' || actualPosition === 'bottom'
      ? tooltipHeight + TOOLTIP_MARGIN
      : TOOLTIP_WIDTH + TOOLTIP_MARGIN;

    if (preferredPosition === 'bottom' && spaceBottom < neededSpace && spaceTop > spaceBottom) {
      actualPosition = 'top';
    } else if (preferredPosition === 'top' && spaceTop < neededSpace && spaceBottom > spaceTop) {
      actualPosition = 'bottom';
    } else if (preferredPosition === 'left' && spaceLeft < neededSpace && spaceRight > spaceLeft) {
      actualPosition = 'right';
    } else if (preferredPosition === 'right' && spaceRight < neededSpace && spaceLeft > spaceRight) {
      actualPosition = 'left';
    }

    let top = 0;
    let left = 0;

    switch (actualPosition) {
      case 'bottom':
        top = rect.bottom + window.scrollY + TOOLTIP_MARGIN;
        left = rect.left + window.scrollX + (rect.width / 2);
        break;
      case 'top':
        top = rect.top + window.scrollY - TOOLTIP_MARGIN;
        left = rect.left + window.scrollX + (rect.width / 2);
        break;
      case 'left':
        top = rect.top + window.scrollY + (rect.height / 2);
        left = rect.left + window.scrollX - TOOLTIP_MARGIN;
        break;
      case 'right':
        top = rect.top + window.scrollY + (rect.height / 2);
        left = rect.right + window.scrollX + TOOLTIP_MARGIN;
        break;
    }

    // Ensure tooltip stays within horizontal viewport bounds
    const halfTooltipWidth = TOOLTIP_WIDTH / 2;
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      if (left - halfTooltipWidth < VIEWPORT_PADDING) {
        left = halfTooltipWidth + VIEWPORT_PADDING;
      } else if (left + halfTooltipWidth > viewportWidth - VIEWPORT_PADDING) {
        left = viewportWidth - halfTooltipWidth - VIEWPORT_PADDING;
      }
    }

    return { top, left, actualPosition };
  }, []);

  // Check if user has completed this tour before
  useEffect(() => {
    const completed = localStorage.getItem(`tour-completed-${tourKey}`);
    if (!completed) {
      // Wait for page to render, then start tour
      const timer = setTimeout(() => {
        const valid = findValidSteps();
        setValidSteps(valid);
        if (valid.length > 0) {
          setCurrentStep(valid[0]);
          setIsActive(true);
          // Delay showing tooltip for entrance animation
          setTimeout(() => setTooltipVisible(true), 100);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tourKey, findValidSteps]);

  // Update target element and position when step changes
  useEffect(() => {
    if (isActive && steps[currentStep]) {
      const step = steps[currentStep];
      const element = document.querySelector(step.target) as HTMLElement;

      if (element && isElementVisible(element)) {
        setTargetElement(element);
        setTargetRect(element.getBoundingClientRect());

        // Calculate tooltip position
        const position = calculateTooltipPosition(element, step.position || 'bottom');
        setTooltipPosition(position);

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update rect after scroll completes
        setTimeout(() => {
          setTargetRect(element.getBoundingClientRect());
        }, 400);
      } else {
        // Element not found or not visible, skip to next valid step
        const nextValidIndex = validSteps.find(idx => idx > currentStep);
        if (nextValidIndex !== undefined) {
          setCurrentStep(nextValidIndex);
        } else {
          // No more valid steps, complete the tour
          completeTour();
        }
      }
    }
  }, [isActive, currentStep, steps, validSteps, calculateTooltipPosition]);

  // Handle window resize - recalculate position
  useEffect(() => {
    if (!isActive || !targetElement) return;

    const handleResize = () => {
      const step = steps[currentStep];
      if (step && targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
        const position = calculateTooltipPosition(targetElement, step.position || 'bottom');
        setTooltipPosition(position);
      }
    };

    // Debounce resize handler
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('scroll', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isActive, targetElement, currentStep, steps, calculateTooltipPosition]);

  const handleNext = useCallback(() => {
    const currentValidIndex = validSteps.indexOf(currentStep);
    if (currentValidIndex < validSteps.length - 1) {
      setIsTransitioning(true);
      setTooltipVisible(false);

      setTimeout(() => {
        setCurrentStep(validSteps[currentValidIndex + 1]);
        setIsTransitioning(false);
        setTimeout(() => setTooltipVisible(true), 50);
      }, 200);
    } else {
      completeTour();
    }
  }, [currentStep, validSteps]);

  const handlePrevious = useCallback(() => {
    const currentValidIndex = validSteps.indexOf(currentStep);
    if (currentValidIndex > 0) {
      setIsTransitioning(true);
      setTooltipVisible(false);

      setTimeout(() => {
        setCurrentStep(validSteps[currentValidIndex - 1]);
        setIsTransitioning(false);
        setTimeout(() => setTooltipVisible(true), 50);
      }, 200);
    }
  }, [currentStep, validSteps]);

  const handleSkip = useCallback(() => {
    setTooltipVisible(false);
    setTimeout(() => completeTour(), 200);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(`tour-completed-${tourKey}`, 'true');
    setIsActive(false);
    setTooltipVisible(false);
    if (onComplete) {
      onComplete();
    }
  }, [tourKey, onComplete]);

  // Go to specific step via dot navigation
  const goToStep = useCallback((stepIndex: number) => {
    if (validSteps.includes(stepIndex)) {
      setIsTransitioning(true);
      setTooltipVisible(false);

      setTimeout(() => {
        setCurrentStep(stepIndex);
        setIsTransitioning(false);
        setTimeout(() => setTooltipVisible(true), 50);
      }, 200);
    }
  }, [validSteps]);

  // Keyboard navigation (must be after handler definitions)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          handleSkip();
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          handlePrevious();
          break;
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, handleNext, handlePrevious, handleSkip]);

  if (!isActive || !steps[currentStep]) {
    return null;
  }

  const step = steps[currentStep];
  const currentValidIndex = validSteps.indexOf(currentStep);
  const progress = ((currentValidIndex + 1) / validSteps.length) * 100;
  const isFirstStep = currentValidIndex === 0;
  const isLastStep = currentValidIndex === validSteps.length - 1;

  // Get transform based on position
  const getTooltipTransform = () => {
    switch (tooltipPosition.actualPosition) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0, -50%)';
    }
  };

  return (
    <>
      {/* Overlay with highlighted element */}
      <div
        className={cn(
          "fixed inset-0 z-[100] pointer-events-none transition-opacity duration-300",
          tooltipVisible ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Highlight target element with pulsing ring */}
        {targetRect && (
          <div
            className="fixed rounded-lg pointer-events-none transition-all duration-300"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Solid visible ring */}
            <div className="absolute inset-0 rounded-lg border-[3px] border-primary shadow-lg shadow-primary/30" />
            {/* Animated outer ring */}
            <div
              className="absolute inset-[-6px] rounded-xl border-[3px] border-primary/60"
              style={{
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-[101] pointer-events-auto transition-all duration-300 ease-out",
          tooltipVisible && !isTransitioning
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95"
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: getTooltipTransform(),
          width: TOOLTIP_WIDTH,
          maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Colored header bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary"
               style={{ width: `${progress}%`, transition: 'width 0.3s ease-out' }} />

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                  {step.title}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Step {currentValidIndex + 1} of {validSteps.length}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-7 w-7 p-0 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                aria-label="Close tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              {step.content}
            </p>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {validSteps.map((stepIdx, i) => (
                <button
                  key={stepIdx}
                  onClick={() => goToStep(stepIdx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    stepIdx === currentStep
                      ? "bg-primary w-6"
                      : "bg-gray-300 hover:bg-gray-400"
                  )}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 text-xs"
              >
                Skip tour
              </Button>

              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 bg-primary hover:bg-primary/90"
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                  {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="mt-3 pt-3 border-t border-gray-100 text-center">
              <span className="text-[10px] text-gray-400">
                Use arrow keys to navigate, Esc to close
              </span>
            </div>
          </div>
        </div>

        {/* Arrow pointer */}
        <div
          className={cn(
            "absolute w-3 h-3 bg-white border-gray-100 rotate-45",
            tooltipPosition.actualPosition === 'bottom' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t",
            tooltipPosition.actualPosition === 'top' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b",
            tooltipPosition.actualPosition === 'left' && "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-t border-r",
            tooltipPosition.actualPosition === 'right' && "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-b border-l"
          )}
        />
      </div>
    </>
  );
};

// Helper hook to reset a tour (useful for testing or user preference)
export const useResetTour = (tourKey: string) => {
  return useCallback(() => {
    localStorage.removeItem(`tour-completed-${tourKey}`);
  }, [tourKey]);
};

// Helper hook to manually trigger a tour
export const useTriggerTour = (tourKey: string) => {
  return useCallback(() => {
    localStorage.removeItem(`tour-completed-${tourKey}`);
    // Force a re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('tour-reset', { detail: tourKey }));
  }, [tourKey]);
};
