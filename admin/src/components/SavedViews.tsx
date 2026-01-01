import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface SavedView {
  id: number;
  name: string;
  description?: string;
  is_public: boolean;
  filters: {
    statuses?: string[];
    tags?: string[];
    sources?: string[];
    dateRange?: { start?: string; end?: string };
  };
  sort_by: string;
  sort_order: string;
  display_mode: 'list' | 'kanban' | 'table';
}

interface SavedViewsProps {
  currentFilters: SavedView['filters'];
  onViewSelect: (view: SavedView | null) => void;
  selectedViewId?: number | null;
}

export function SavedViews({ currentFilters, onViewSelect, selectedViewId }: SavedViewsProps) {
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDescription, setNewViewDescription] = useState('');
  const [newViewIsPublic, setNewViewIsPublic] = useState(false);

  const { data: views = [], isLoading } = useQuery<SavedView[]>({
    queryKey: ['saved-views', workspace],
    queryFn: () => api<SavedView[]>(`/api/v1/admin/workspaces/${workspace}/views`),
  });

  const createViewMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; is_public: boolean; filters: SavedView['filters'] }) =>
      api<SavedView>(`/api/v1/admin/workspaces/${workspace}/views`, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          sort_by: 'created_at',
          sort_order: 'desc',
          display_mode: 'table',
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views', workspace] });
      setIsCreateOpen(false);
      setNewViewName('');
      setNewViewDescription('');
      setNewViewIsPublic(false);
      toast({
        title: 'View saved',
        description: 'Your view has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save view',
        variant: 'destructive',
      });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: number) =>
      api(`/api/v1/admin/workspaces/${workspace}/views/${viewId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views', workspace] });
      onViewSelect(null);
      toast({
        title: 'View deleted',
        description: 'The view has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete view',
        variant: 'destructive',
      });
    },
  });

  const handleCreateView = () => {
    if (!newViewName.trim()) return;
    createViewMutation.mutate({
      name: newViewName.trim(),
      description: newViewDescription.trim() || undefined,
      is_public: newViewIsPublic,
      filters: currentFilters,
    });
  };

  const handleViewChange = (viewId: string) => {
    if (viewId === 'all') {
      onViewSelect(null);
    } else {
      const view = views.find((v) => v.id === Number(viewId));
      if (view) {
        onViewSelect(view);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedViewId?.toString() || 'all'}
        onValueChange={handleViewChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select view" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Feedback</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id.toString()}>
              {view.name}
              {view.is_public && ' (Public)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Save current view">
            <Save className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save your current filters as a reusable view
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Bug Reports This Week"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="view-description">Description (optional)</Label>
              <Input
                id="view-description"
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
                placeholder="Brief description of this view"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="view-public"
                checked={newViewIsPublic}
                onCheckedChange={(checked) => setNewViewIsPublic(checked === true)}
              />
              <Label htmlFor="view-public">Make this view public (visible to all team members)</Label>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <strong>Current filters:</strong>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {currentFilters.statuses?.length ? (
                  <li>Statuses: {currentFilters.statuses.join(', ')}</li>
                ) : null}
                {currentFilters.tags?.length ? (
                  <li>Tags: {currentFilters.tags.join(', ')}</li>
                ) : null}
                {currentFilters.sources?.length ? (
                  <li>Sources: {currentFilters.sources.join(', ')}</li>
                ) : null}
                {currentFilters.dateRange?.start || currentFilters.dateRange?.end ? (
                  <li>
                    Date: {currentFilters.dateRange.start || 'Any'} -{' '}
                    {currentFilters.dateRange.end || 'Any'}
                  </li>
                ) : null}
                {!currentFilters.statuses?.length &&
                  !currentFilters.tags?.length &&
                  !currentFilters.sources?.length &&
                  !currentFilters.dateRange?.start &&
                  !currentFilters.dateRange?.end && <li>No filters applied</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateView}
              disabled={!newViewName.trim() || createViewMutation.isPending}
            >
              {createViewMutation.isPending ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedViewId && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (confirm('Are you sure you want to delete this view?')) {
              deleteViewMutation.mutate(selectedViewId);
            }
          }}
          disabled={deleteViewMutation.isPending}
          title="Delete view"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
