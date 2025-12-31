import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useUpdateFeedback } from '@/hooks/useFeedback';
import type { FeedbackStatus, FeedbackItem } from '@/types/feedback';

interface StatusEditorProps {
  item: FeedbackItem;
  workspace: string;
}

const statusConfig: Record<FeedbackStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { label: 'Open', variant: 'outline' },
  planned: { label: 'Planned', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  done: { label: 'Done', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
};

const statusOptions: FeedbackStatus[] = ['open', 'planned', 'in_progress', 'done', 'declined'];

export function StatusEditor({ item, workspace }: StatusEditorProps) {
  const [optimisticStatus, setOptimisticStatus] = useState(item.status);
  const { toast } = useToast();
  const updateMutation = useUpdateFeedback(workspace);

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    const previousStatus = optimisticStatus;
    setOptimisticStatus(newStatus);

    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: { status: newStatus },
      });

      toast({
        title: 'Status updated',
        description: `Changed to ${statusConfig[newStatus].label}`,
      });
    } catch (error) {
      setOptimisticStatus(previousStatus);
      toast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const config = statusConfig[optimisticStatus];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant={config.variant}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          {config.label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statusOptions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={status === optimisticStatus}
          >
            {statusConfig[status].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
