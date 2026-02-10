import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import type { MealPlan } from '../../../types/api';

interface WeeklyVarietySummaryProps {
  weekPlan: MealPlan[];
}

const WeeklyVarietySummary: React.FC<WeeklyVarietySummaryProps> = ({ weekPlan }) => {
  const cuisineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    weekPlan.forEach((meal) => {
      if (meal.cuisine) {
        counts[meal.cuisine] = (counts[meal.cuisine] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [weekPlan]);

  const hasLowVariety = useMemo(() => {
    return cuisineCounts.some(([_, count]) => count >= 4);
  }, [cuisineCounts]);

  if (cuisineCounts.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-start gap-3">
        <div className="text-sm font-medium text-muted-foreground min-w-[80px] pt-1">
          This week:
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            {cuisineCounts.map(([cuisine, count]) => (
              <div
                key={cuisine}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                  count >= 4
                    ? 'bg-orange-100 text-orange-900 border border-orange-200'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <span className="font-medium">{cuisine}</span>
                <span className="text-xs opacity-75">×{count}</span>
              </div>
            ))}
          </div>
          {hasLowVariety && (
            <div className="flex items-start gap-2 mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-900">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                You have the same cuisine 4+ times this week. Consider adding variety!
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyVarietySummary;
