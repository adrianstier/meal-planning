import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi } from '../lib/api';
import type { MealPlan, PlanConstraints } from '../types/api';

// Helper to get the Monday of the week for a given date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
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
  });
};

export const useSuggestMeal = () => {
  return useMutation({
    mutationFn: ({ date, mealType, constraints }: { date: string; mealType: string; constraints?: PlanConstraints }) =>
      planApi.suggest(date, mealType, constraints),
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
  });
};

export const useClearWeekPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (startDate: string) => planApi.clearWeek(startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
  });
};
