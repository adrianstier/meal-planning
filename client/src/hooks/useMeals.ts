import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealsApi } from '../lib/api';
import type { Meal } from '../types/api';

export const useMeals = () => {
  return useQuery({
    queryKey: ['meals'],
    queryFn: async () => {
      const response = await mealsApi.getAll();
      return response.data;
    },
  });
};

export const useMeal = (id: number) => {
  return useQuery({
    queryKey: ['meal', id],
    queryFn: async () => {
      const response = await mealsApi.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateMeal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meal: Partial<Meal>) => mealsApi.create(meal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
};

export const useUpdateMeal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, meal }: { id: number; meal: Partial<Meal> }) =>
      mealsApi.update(id, meal),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal', variables.id] });
    },
  });
};

export const useDeleteMeal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
};

export const useParseRecipe = () => {
  return useMutation({
    mutationFn: (recipeText: string) => mealsApi.parseRecipe(recipeText),
  });
};

export const useSearchMeals = (query: string) => {
  return useQuery({
    queryKey: ['meals', 'search', query],
    queryFn: async () => {
      const response = await mealsApi.search(query);
      return response.data;
    },
    enabled: query.length > 0,
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: number; isFavorite: boolean }) =>
      isFavorite ? mealsApi.unfavorite(id) : mealsApi.favorite(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal', variables.id] });
    },
  });
};
