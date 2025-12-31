import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUpdateFeedback } from '@/hooks/useFeedback';
import { Check, X } from 'lucide-react';
import type { ModerationState, FeedbackItem } from '@/types/feedback';

interface ModerationActionsProps {
  item: FeedbackItem;
  workspace: string;
}

const moderationConfig: Record<ModerationState, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export function ModerationActions({ item, workspace }: ModerationActionsProps) {
  const [optimisticState, setOptimisticState] = useState(item.moderation_state);
  const { toast } = useToast();
  const updateMutation = useUpdateFeedback(workspace);

  const handleModeration = async (newState: ModerationState) => {
    const previousState = optimisticState;
    setOptimisticState(newState);

    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: { moderation_state: newState },
      });

      toast({
        title: 'Moderation updated',
        description: `Feedback ${newState}`,
      });
    } catch (error) {
      setOptimisticState(previousState);
      toast({
        title: 'Failed to update moderation',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const config = moderationConfig[optimisticState];

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant}>
        {config.label}
      </Badge>

      {optimisticState !== 'approved' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleModeration('approved')}
          disabled={updateMutation.isPending}
          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Check className="h-4 w-4" />
        </Button>
      )}

      {optimisticState !== 'rejected' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleModeration('rejected')}
          disabled={updateMutation.isPending}
          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
