import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shoppingApi } from '../lib/api';

export const useShoppingItems = () => {
  return useQuery({
    queryKey: ['shopping'],
    queryFn: async () => {
      const response = await shoppingApi.getAll();
      return response.data;
    },
  });
};

export const useGenerateShoppingList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
      shoppingApi.generateFromPlan(startDate, endDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};

export const useAddShoppingItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: { item_name: string; category?: string; quantity?: string }) =>
      shoppingApi.add(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};

export const useToggleShoppingItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => shoppingApi.togglePurchased(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};

export const useDeleteShoppingItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => shoppingApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};

export const useClearPurchased = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => shoppingApi.clearPurchased(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};

export const useClearAllShopping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => shoppingApi.clearAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
};
