import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi } from '../lib/api';
import type { MealPlan, PlanConstraints } from '../types/api';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
  });
};

export const useUpdatePlanItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, plan }: { id: number; plan: Partial<MealPlan> }) =>
      planApi.update(id, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
  });
};

export const useDeletePlanItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => planApi.delete(id),
    onSuccess: () => {
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
