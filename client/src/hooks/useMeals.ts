import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { mealsApi } from '../lib/api';
import { errorLogger } from '../utils/errorLogger';
import type { Meal } from '../types/api';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Search debounce delay
const SEARCH_DEBOUNCE_MS = 300;

// Cache configuration constants
const STALE_TIME = 5 * 60 * 1000; // 5 minutes - data considered fresh
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes - keep in cache

export const useMeals = () => {
  return useQuery({
    queryKey: ['meals'],
    queryFn: async () => {
      const response = await mealsApi.getAll();
      return response.data;
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME, // gcTime replaces cacheTime in TanStack Query v5
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
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/meals', 'POST');
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
    onError: (error, variables) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), `/meals/${variables.id}`, 'PUT');
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
    onError: (error, id) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), `/meals/${id}`, 'DELETE');
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
  // Debounce the search query to prevent excessive API calls
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: ['meals', 'search', debouncedQuery],
    queryFn: async () => {
      const response = await mealsApi.search(debouncedQuery);
      return response.data;
    },
    enabled: debouncedQuery.length > 0,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
};

// Export the debounce hook for use elsewhere
export { useDebounce };

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: number; isFavorite: boolean }) =>
      isFavorite ? mealsApi.unfavorite(id) : mealsApi.favorite(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal', variables.id] });
    },
    onError: (error, variables) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), `/meals/${variables.id}/favorite`, 'POST');
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
    onError: (error) => {
      errorLogger.logApiError(error instanceof Error ? error : new Error(String(error)), '/meals/bulk-delete', 'POST');
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
