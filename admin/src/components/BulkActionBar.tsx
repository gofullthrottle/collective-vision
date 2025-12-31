import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useBulkAction } from '@/hooks/useFeedback';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import type { FeedbackStatus } from '@/types/feedback';

interface BulkActionBarProps {
  selectedIds: number[];
  workspace: string;
  onClearSelection: () => void;
}

export function BulkActionBar({ selectedIds, workspace, onClearSelection }: BulkActionBarProps) {
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus>('open');
  const { toast } = useToast();
  const bulkAction = useBulkAction(workspace);

  if (selectedIds.length === 0) return null;

  const handleApproveAll = async () => {
    try {
      await bulkAction.mutateAsync({
        ids: selectedIds,
        action: 'approve',
      });

      toast({
        title: 'Approved',
        description: `${selectedIds.length} items approved`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: 'Failed to approve',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleRejectAll = async () => {
    try {
      await bulkAction.mutateAsync({
        ids: selectedIds,
        action: 'reject',
      });

      toast({
        title: 'Rejected',
        description: `${selectedIds.length} items rejected`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: 'Failed to reject',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleSetStatus = async () => {
    try {
      await bulkAction.mutateAsync({
        ids: selectedIds,
        action: 'set_status',
        status: selectedStatus,
      });

      toast({
        title: 'Status updated',
        description: `${selectedIds.length} items updated to ${selectedStatus}`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container flex items-center justify-between h-16 max-w-screen-2xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApproveAll}
            disabled={bulkAction.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Approve All
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectAll}
            disabled={bulkAction.isPending}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Reject All
          </Button>

          <div className="flex items-center gap-2">
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as FeedbackStatus)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleSetStatus}
              disabled={bulkAction.isPending}
            >
              Set Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
