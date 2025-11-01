import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leftoversApi } from '../lib/api';

export const useLeftovers = () => {
  return useQuery({
    queryKey: ['leftovers'],
    queryFn: async () => {
      const response = await leftoversApi.getActive();
      return response.data;
    },
  });
};

export const useAddLeftover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leftover: { meal_id: number; cooked_date?: string; servings?: number; days_good?: number; notes?: string }) =>
      leftoversApi.add(leftover),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leftovers'] });
    },
  });
};

export const useConsumeLeftover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => leftoversApi.consume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leftovers'] });
    },
  });
};

export const useUpdateLeftoverServings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, servings }: { id: number; servings: number }) =>
      leftoversApi.updateServings(id, servings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leftovers'] });
    },
  });
};

export const useLeftoverSuggestions = () => {
  return useQuery({
    queryKey: ['leftovers', 'suggestions'],
    queryFn: async () => {
      const response = await leftoversApi.getSuggestions();
      return response.data;
    },
  });
};
