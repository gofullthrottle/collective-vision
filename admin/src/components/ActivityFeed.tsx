import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { FeedbackItem } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ActivityFeedProps {
  items: FeedbackItem[];
  isLoading?: boolean;
}

function getStatusColor(status: FeedbackItem['status']): string {
  const colors: Record<FeedbackItem['status'], string> = {
    open: 'bg-blue-500',
    under_review: 'bg-yellow-500',
    planned: 'bg-purple-500',
    in_progress: 'bg-orange-500',
    done: 'bg-green-500',
    declined: 'bg-gray-500',
  };
  return colors[status] || 'bg-gray-500';
}

function getModerationBadge(state: FeedbackItem['moderation_state']) {
  const variants: Record<FeedbackItem['moderation_state'], 'default' | 'secondary' | 'destructive'> = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
  };
  return variants[state] || 'default';
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b last:border-0">
      <Skeleton className="h-2 w-2 rounded-full mt-2" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest feedback submissions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityItemSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest feedback submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No feedback items yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest feedback submissions</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/feedback?id=${item.id}`)}
            className="flex items-start gap-4 p-4 border-b last:border-0 cursor-pointer hover:bg-accent transition-colors"
          >
            <div
              className={`h-2 w-2 rounded-full mt-2 ${getStatusColor(item.status)}`}
              aria-label={`Status: ${item.status}`}
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm mb-1 truncate">{item.title}</h4>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {item.status.replace('_', ' ')}
                </Badge>
                <Badge variant={getModerationBadge(item.moderation_state)} className="text-xs">
                  {item.moderation_state}
                </Badge>
                {item.vote_count !== undefined && item.vote_count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {item.vote_count} votes
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                {item.author_name && ` by ${item.author_name}`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
