import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortingState } from '@tanstack/react-table';
import { FeedbackTable } from '@/components/FeedbackTable';
import { FeedbackFilters } from '@/components/FeedbackFilters';
import { Pagination } from '@/components/Pagination';
import { BulkActionBar } from '@/components/BulkActionBar';
import { Toaster } from '@/components/ui/toaster';
import { useFeedback } from '@/hooks/useFeedback';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { FeedbackStatus, ModerationState } from '@/types/feedback';

export default function Feedback() {
  const { workspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL params
  const [status, setStatus] = useState<FeedbackStatus[]>(
    searchParams.get('status')?.split(',').filter(Boolean) as FeedbackStatus[] || []
  );
  const [moderationState, setModerationState] = useState<ModerationState[]>(
    searchParams.get('moderation_state')?.split(',').filter(Boolean) as ModerationState[] || []
  );
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 20);
  const [offset, setOffset] = useState(Number(searchParams.get('offset')) || 0);
  const [sorting, setSorting] = useState<SortingState>(() => {
    const sort = searchParams.get('sort');
    const order = searchParams.get('order');
    return sort ? [{ id: sort, desc: order === 'desc' }] : [];
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (status.length) params.set('status', status.join(','));
    if (moderationState.length) params.set('moderation_state', moderationState.join(','));
    if (search) params.set('search', search);
    if (limit !== 20) params.set('limit', limit.toString());
    if (offset !== 0) params.set('offset', offset.toString());
    if (sorting.length) {
      params.set('sort', sorting[0].id);
      params.set('order', sorting[0].desc ? 'desc' : 'asc');
    }
    setSearchParams(params, { replace: true });
  }, [status, moderationState, search, limit, offset, sorting, setSearchParams]);

  // Fetch data
  const { data, isLoading, error } = useFeedback(workspace, {
    status,
    moderation_state: moderationState,
    search,
    sort: sorting[0]?.id,
    order: sorting[0]?.desc ? 'desc' : 'asc',
    limit,
    offset,
  });

  const handleClearFilters = () => {
    setStatus([]);
    setModerationState([]);
    setSearch('');
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Manage and moderate user feedback submissions
        </p>
      </div>

      <FeedbackFilters
        status={status}
        moderationState={moderationState}
        search={search}
        onStatusChange={setStatus}
        onModerationStateChange={setModerationState}
        onSearchChange={setSearch}
        onClearAll={handleClearFilters}
      />

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Error loading feedback: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Loading feedback...
        </div>
      ) : data ? (
        <>
          <FeedbackTable
            data={data.items}
            workspace={workspace}
            sorting={sorting}
            onSortingChange={setSorting}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />

          <Pagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            onLimitChange={setLimit}
            onOffsetChange={setOffset}
          />
        </>
      ) : null}

      <BulkActionBar
        selectedIds={selectedIds}
        workspace={workspace}
        onClearSelection={handleClearSelection}
      />

      <Toaster />
    </div>
  );
}
