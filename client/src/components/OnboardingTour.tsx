import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';

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

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  tourKey,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Check if user has completed this tour before
  useEffect(() => {
    const completed = localStorage.getItem(`tour-completed-${tourKey}`);
    if (!completed) {
      // Wait for page to render, then start tour
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tourKey]);

  // Update target element and position when step changes
  useEffect(() => {
    if (isActive && steps[currentStep]) {
      const step = steps[currentStep];
      const element = document.querySelector(step.target) as HTMLElement;

      if (element) {
        setTargetElement(element);

        // Calculate tooltip position
        const rect = element.getBoundingClientRect();
        const position = step.position || 'bottom';

        let top = 0;
        let left = 0;

        switch (position) {
          case 'bottom':
            top = rect.bottom + window.scrollY + 10;
            left = rect.left + window.scrollX + (rect.width / 2);
            break;
          case 'top':
            top = rect.top + window.scrollY - 10;
            left = rect.left + window.scrollX + (rect.width / 2);
            break;
          case 'left':
            top = rect.top + window.scrollY + (rect.height / 2);
            left = rect.left + window.scrollX - 10;
            break;
          case 'right':
            top = rect.top + window.scrollY + (rect.height / 2);
            left = rect.right + window.scrollX + 10;
            break;
        }

        setTooltipPosition({ top, left });

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isActive, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    localStorage.setItem(`tour-completed-${tourKey}`, 'true');
    setIsActive(false);
    if (onComplete) {
      onComplete();
    }
  };

  if (!isActive || !steps[currentStep]) {
    return null;
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay with highlighted element */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Highlight target element */}
        {targetElement && (
          <div
            className="absolute border-4 border-primary rounded-lg pointer-events-none"
            style={{
              top: targetElement.getBoundingClientRect().top + window.scrollY - 4,
              left: targetElement.getBoundingClientRect().left + window.scrollX - 4,
              width: targetElement.offsetWidth + 8,
              height: targetElement.offsetHeight + 8,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[101] pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translateX(-50%)',
          maxWidth: '400px',
        }}
      >
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900">
                {step.title}
              </h3>
              <div className="text-xs text-gray-500 mt-1">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="h-6 w-6 p-0 -mr-2 -mt-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-gray-200 rounded-full mb-3">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <p className="text-sm text-gray-700 mb-4">
            {step.content}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-600"
            >
              Skip tour
            </Button>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  Previous
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
              >
                {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Helper hook to reset a tour (useful for testing or user preference)
export const useResetTour = (tourKey: string) => {
  return () => {
    localStorage.removeItem(`tour-completed-${tourKey}`);
  };
};
