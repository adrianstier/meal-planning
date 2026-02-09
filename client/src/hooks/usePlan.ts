import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi } from '../lib/api';
import { errorLogger } from '../utils/errorLogger';
import type { MealPlan, PlanConstraints } from '../types/api';

// Helper to get the Sunday of the week for a given date
// Uses local timezone to avoid UTC midnight shift issues
// Note: The app uses weekStartsOn: 0 (Sunday) in date-fns startOfWeek
function getWeekStart(dateStr: string): string {
  // Parse as local date by splitting the string (avoids UTC interpretation)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const diff = date.getDate() - dayOfWeek; // Go back to Sunday
  const sunday = new Date(date.getFullYear(), date.getMonth(), diff);
  // Format as YYYY-MM-DD in local timezone
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const useWeekPlan = (startDate: string) => {
  return useQuery({
    queryKey: ['plan', 'week', startDate],
    queryFn: async () => {
      const response = await planApi.getWeek(startDate);
      return response.data;
    },
  });
};

export const useAddPlanItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: Partial<MealPlan>) => planApi.add(plan),
    onSuccess: (_data, variables) => {
      // Invalidate only the specific week that was affected
      if (variables.plan_date) {
        const weekStart = getWeekStart(variables.plan_date);
        queryClient.invalidateQueries({ queryKey: ['plan', 'week', weekStart] });
      } else {
        // Fallback to invalidating all plan queries
        queryClient.invalidateQueries({ queryKey: ['plan'] });
      }
    },
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/plan', 'POST');
    },
  });
};

export const useUpdatePlanItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, plan }: { id: number; plan: Partial<MealPlan> }) =>
      planApi.update(id, plan),
    onSuccess: (_data, variables) => {
      // Invalidate only the specific week that was affected
      if (variables.plan.plan_date) {
        const weekStart = getWeekStart(variables.plan.plan_date);
        queryClient.invalidateQueries({ queryKey: ['plan', 'week', weekStart] });
      } else {
        // Fallback to invalidating all plan queries
        queryClient.invalidateQueries({ queryKey: ['plan'] });
      }
    },
    onError: (error, variables) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), `/plan/${variables.id}`, 'PUT');
    },
  });
};

export const useDeletePlanItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => planApi.delete(id),
    onSuccess: () => {
      // For delete, we don't know the date, so invalidate all plan queries
      // Could be optimized by passing the date as context
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
    onError: (error, id) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), `/plan/${id}`, 'DELETE');
    },
  });
};

export const useSuggestMeal = () => {
  return useMutation({
    mutationFn: ({ date, mealType, constraints }: { date: string; mealType: string; constraints?: PlanConstraints }) =>
      planApi.suggest(date, mealType, constraints),
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/plan/suggest', 'POST');
    },
  });
};

export const useGenerateWeekPlan = () => {
  return useMutation({
    mutationFn: ({ startDate, numDays, mealTypes, avoidSchoolDuplicates, cuisines, generateBentos, bentoChildName }: {
      startDate: string;
      numDays?: number;
      mealTypes?: string[];
      avoidSchoolDuplicates?: boolean;
      cuisines?: string[] | 'all';
      generateBentos?: boolean;
      bentoChildName?: string;
    }) => planApi.generateWeek(startDate, numDays, mealTypes, avoidSchoolDuplicates, cuisines, generateBentos, bentoChildName),
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/plan/generate-week', 'POST');
    },
  });
};

interface GeneratedMealPlanItem {
  meal_id: number;
  date: string;
  meal_type: string;
}

export const useApplyGeneratedPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: GeneratedMealPlanItem[]) => planApi.applyGenerated(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/plan/apply-generated', 'POST');
    },
  });
};

export const useClearWeekPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (startDate: string) => planApi.clearWeek(startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/plan/clear-week', 'POST');
    },
  });
};
