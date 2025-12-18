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
    mutationFn: async (recipeText: string) => {
      try {
        const response = await mealsApi.parseRecipe(recipeText);
        return response;
      } catch (error) {
        // Ensure errors are properly thrown so React Query catches them
        console.error('Parse recipe mutation error:', error);
        throw error;
      }
    },
    // Add retry configuration - don't retry on parse errors
    retry: false,
    // Add mutation metadata for debugging
    onError: (error) => {
      console.error('Recipe parse failed:', error);
    },
  });
};

export const useParseRecipeFromImage = () => {
  return useMutation({
    mutationFn: async (imageFile: File) => {
      try {
        const response = await mealsApi.parseRecipeFromImage(imageFile);
        return response;
      } catch (error) {
        console.error('Parse recipe from image mutation error:', error);
        throw error;
      }
    },
    retry: false,
    onError: (error) => {
      console.error('Recipe image parse failed:', error);
    },
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

export const useBulkDeleteMeals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealIds: number[]) => mealsApi.bulkDelete(mealIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
};

export const useParseRecipeFromUrl = () => {
  return useMutation({
    mutationFn: async (url: string) => {
      try {
        const response = await mealsApi.parseRecipeFromUrl(url);
        return response;
      } catch (error) {
        console.error('Parse recipe from URL mutation error:', error);
        throw error;
      }
    },
    retry: false,
    onError: (error) => {
      console.error('Recipe URL parse failed:', error);
    },
  });
};

export const useParseRecipeFromUrlAI = () => {
  return useMutation({
    mutationFn: async (url: string) => {
      try {
        const response = await mealsApi.parseRecipeFromUrlAI(url);
        return response;
      } catch (error) {
        console.error('Parse recipe from URL (AI) mutation error:', error);
        throw error;
      }
    },
    retry: false,
    onError: (error) => {
      console.error('Recipe URL AI parse failed:', error);
    },
  });
};
