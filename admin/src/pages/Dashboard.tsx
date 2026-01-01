import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { DashboardStats, FeedbackItem } from '@/types/api';
import { StatCard } from '@/components/StatCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AnalyticsCharts } from '@/components/AnalyticsCharts';
import { DashboardWidgets } from '@/components/DashboardWidgets';
import { MessageSquare, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { workspace } = useWorkspace();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', workspace],
    queryFn: () => api<DashboardStats>(`/api/v1/admin/workspaces/${workspace}/stats`),
    refetchInterval: 30000, // Refresh every 30s
  });

  const {
    data: recentFeedback,
    isLoading: feedbackLoading,
    error: feedbackError,
  } = useQuery<FeedbackItem[]>({
    queryKey: ['recent-feedback', workspace],
    queryFn: () => api<FeedbackItem[]>(`/api/v1/admin/workspaces/${workspace}/feedback/recent?limit=10`),
    refetchInterval: 30000, // Refresh every 30s
  });

  const error = statsError || feedbackError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your feedback platform
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load dashboard data'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Feedback"
          value={stats?.totalFeedback ?? 0}
          icon={MessageSquare}
          description="All feedback items"
          isLoading={statsLoading}
        />
        <StatCard
          title="Pending Moderation"
          value={stats?.pendingModeration ?? 0}
          icon={Clock}
          description="Awaiting review"
          isLoading={statsLoading}
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday ?? 0}
          icon={CheckCircle}
          description="Last 24 hours"
          isLoading={statsLoading}
        />
        <StatCard
          title="Top Voted"
          value={stats?.topVotedVotes ?? 0}
          icon={TrendingUp}
          description={stats?.topVotedTitle ? `"${stats.topVotedTitle.slice(0, 30)}..."` : 'No votes yet'}
          isLoading={statsLoading}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="widgets">Widgets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ActivityFeed
            items={recentFeedback ?? []}
            isLoading={feedbackLoading}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsCharts />
        </TabsContent>

        <TabsContent value="widgets" className="space-y-4">
          <DashboardWidgets />
        </TabsContent>
      </Tabs>
    </div>
  );
}
