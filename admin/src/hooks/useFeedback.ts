import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedbackItem, FeedbackListResponse, FeedbackFilters, BulkActionPayload } from '@/types/feedback';

interface FeedbackQueryParams extends FeedbackFilters {
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function useFeedback(workspace: string, params: FeedbackQueryParams) {
  const queryParams = new URLSearchParams();

  if (params.status?.length) queryParams.set('status', params.status.join(','));
  if (params.moderation_state?.length) queryParams.set('moderation_state', params.moderation_state.join(','));
  if (params.search) queryParams.set('search', params.search);
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.order) queryParams.set('order', params.order);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  return useQuery<FeedbackListResponse>({
    queryKey: ['feedback', workspace, params],
    queryFn: () => api(`/api/v1/admin/workspaces/${workspace}/feedback?${queryParams.toString()}`),
  });
}

export function useUpdateFeedback(workspace: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<FeedbackItem> }) =>
      api(`/api/v1/admin/workspaces/${workspace}/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', workspace] });
    },
  });
}

export function useDeleteFeedback(workspace: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/workspaces/${workspace}/feedback/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', workspace] });
    },
  });
}

export function useBulkAction(workspace: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkActionPayload) =>
      api(`/api/v1/admin/workspaces/${workspace}/feedback/bulk`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', workspace] });
    },
  });
}
