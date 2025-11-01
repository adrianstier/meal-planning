import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolMenuApi } from '../lib/api';
import type { SchoolMenuItem } from '../types/api';

export const useSchoolMenu = () => {
  return useQuery({
    queryKey: ['school-menu'],
    queryFn: async () => {
      const response = await schoolMenuApi.getAll();
      return response.data;
    },
  });
};

export const useSchoolMenuByDate = (date: string) => {
  return useQuery({
    queryKey: ['school-menu', 'date', date],
    queryFn: async () => {
      const response = await schoolMenuApi.getByDate(date);
      return response.data;
    },
    enabled: !!date,
  });
};

export const useSchoolMenuRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['school-menu', 'range', startDate, endDate],
    queryFn: async () => {
      const response = await schoolMenuApi.getRange(startDate, endDate);
      return response.data;
    },
    enabled: !!startDate && !!endDate,
  });
};

export const useAddSchoolMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: Partial<SchoolMenuItem>) => schoolMenuApi.add(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-menu'] });
    },
  });
};

export const useAddSchoolMenuBulk = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Partial<SchoolMenuItem>[]) => schoolMenuApi.addBulk(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-menu'] });
    },
  });
};

export const useDeleteSchoolMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => schoolMenuApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-menu'] });
    },
  });
};

export const useAddMenuFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ menuItemId, feedbackType, notes }: { menuItemId: number; feedbackType: 'disliked' | 'allergic' | 'wont_eat'; notes?: string }) =>
      schoolMenuApi.addFeedback(menuItemId, feedbackType, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-menu'] });
    },
  });
};

export const useLunchAlternatives = (date: string) => {
  return useQuery({
    queryKey: ['lunch-alternatives', date],
    queryFn: async () => {
      const response = await schoolMenuApi.getLunchAlternatives(date);
      return response.data;
    },
    enabled: !!date,
  });
};

export const useParseMenuPhoto = () => {
  return useMutation({
    mutationFn: ({ imageData, imageType, autoAdd }: { imageData: string; imageType: string; autoAdd?: boolean }) =>
      schoolMenuApi.parsePhoto(imageData, imageType, autoAdd),
  });
};

export const useSchoolMenuCalendar = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['school-menu', 'calendar', startDate, endDate],
    queryFn: async () => {
      const response = await schoolMenuApi.getCalendar(startDate, endDate);
      return response.data.calendar_data;
    },
  });
};
