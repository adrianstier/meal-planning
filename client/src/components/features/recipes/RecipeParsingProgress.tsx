import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';
import { Progress } from '../../ui/progress';

interface RecipeParsingProgressProps {
  isVisible: boolean;
  error?: string | null;
}

const PARSING_STEPS = [
  { label: 'Fetching recipe...', duration: 2000 },
  { label: 'Analyzing with AI...', duration: 15000 },
  { label: 'Extracting ingredients...', duration: 5000 },
  { label: 'Downloading image...', duration: 3000 },
  { label: 'Finalizing...', duration: 2000 },
];

export const RecipeParsingProgress: React.FC<RecipeParsingProgressProps> = ({
  isVisible,
  error,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible || error) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let startTime = Date.now();
    const totalDuration = PARSING_STEPS.reduce((sum, step) => sum + step.duration, 0);

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(newProgress);

      // Update current step based on elapsed time
      let cumulativeDuration = 0;
      for (let i = 0; i < PARSING_STEPS.length; i++) {
        cumulativeDuration += PARSING_STEPS[i].duration;
        if (elapsed < cumulativeDuration) {
          setCurrentStep(i);
          break;
        }
      }

      if (elapsed < totalDuration) {
        timeoutId = setTimeout(updateProgress, 100);
      }
    };

    updateProgress();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isVisible, error]);

  if (!isVisible) return null;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {PARSING_STEPS[currentStep]?.label || 'Processing...'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Step {currentStep + 1} of {PARSING_STEPS.length}
              </p>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="space-y-1">
            {PARSING_STEPS.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 text-xs transition-opacity ${
                  index === currentStep
                    ? 'text-blue-600 font-medium'
                    : index < currentStep
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : index === currentStep ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-gray-300" />
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 flex items-start gap-1">
              <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" /> <span><strong>Tip:</strong> This may take 30-60 seconds for complex recipes. The AI is
              carefully extracting ingredients, instructions, and nutritional info!</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};
