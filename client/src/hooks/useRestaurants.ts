import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '../lib/api';
import type { Restaurant, RestaurantFilters } from '../types/api';

export const useRestaurants = (filters?: RestaurantFilters) => {
  return useQuery({
    queryKey: ['restaurants', filters],
    queryFn: async () => {
      const response = await restaurantsApi.getAll(filters);
      return response.data;
    },
  });
};

export const useRestaurant = (id: number) => {
  return useQuery({
    queryKey: ['restaurants', id],
    queryFn: async () => {
      const response = await restaurantsApi.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateRestaurant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (restaurant: Partial<Restaurant>) => restaurantsApi.create(restaurant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
  });
};

export const useUpdateRestaurant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, restaurant }: { id: number; restaurant: Partial<Restaurant> }) =>
      restaurantsApi.update(id, restaurant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
  });
};

export const useDeleteRestaurant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => restaurantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
  });
};

export const useSuggestRestaurants = () => {
  return useMutation({
    mutationFn: (filters?: RestaurantFilters) => restaurantsApi.suggest(filters),
  });
};

export const useScrapeRestaurantUrl = () => {
  return useMutation({
    mutationFn: (url: string) => restaurantsApi.scrapeUrl(url),
  });
};
