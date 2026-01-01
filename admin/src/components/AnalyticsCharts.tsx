import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface TrendData {
  period: string;
  total: number;
  widget?: number;
  mcp?: number;
  api?: number;
  import?: number;
}

interface SentimentTrendData {
  period: string;
  avg_sentiment: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
  avg_sentiment: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface AnalyticsData {
  volumeTrend: TrendData[];
  sentimentTrend: SentimentTrendData[];
  bySource: SourceBreakdown[];
  byStatus: StatusBreakdown[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  planned: '#f59e0b',
  in_progress: '#8b5cf6',
  done: '#22c55e',
  archived: '#6b7280',
};

export function AnalyticsCharts() {
  const { workspace } = useWorkspace();

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics-charts', workspace],
    queryFn: async () => {
      const [trends, users] = await Promise.all([
        api<{ volumeTrend: TrendData[]; sentimentTrend: SentimentTrendData[] }>(
          `/api/v1/${workspace}/analytics/trends?interval=day`
        ),
        api<{ bySource: SourceBreakdown[]; byStatus: StatusBreakdown[] }>(
          `/api/v1/${workspace}/analytics/users`
        ),
      ]);
      return {
        volumeTrend: trends.volumeTrend || [],
        sentimentTrend: trends.sentimentTrend || [],
        bySource: users.bySource || [],
        byStatus: users.byStatus || [],
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Failed to load analytics data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="volume" className="w-full">
        <TabsList>
          <TabsTrigger value="volume">Feedback Volume</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="volume" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Volume Over Time</CardTitle>
              <CardDescription>
                Daily feedback submissions by source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.volumeTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Bar dataKey="widget" name="Widget" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="mcp" name="MCP" fill="#22c55e" stackId="a" />
                  <Bar dataKey="api" name="API" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="import" name="Import" fill="#8b5cf6" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Trend</CardTitle>
              <CardDescription>
                Average sentiment score and distribution over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.sentimentTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Avg Sentiment']}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_sentiment"
                    name="Avg Sentiment"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Source</CardTitle>
                <CardDescription>Feedback distribution by source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.bySource || []}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ source, percent }) =>
                        `${source} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {(data?.bySource || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Status</CardTitle>
                <CardDescription>Feedback distribution by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.byStatus || []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ status, percent }) =>
                        `${status} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {(data?.byStatus || []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
