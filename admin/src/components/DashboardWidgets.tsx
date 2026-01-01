import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  MoreVertical,
  Trash2,
  GripVertical,
  BarChart3,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  PieChart,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface DashboardWidget {
  id: number;
  widget_type: 'status_chart' | 'vote_trend' | 'top_feedback' | 'sentiment_gauge' | 'source_breakdown';
  title?: string;
  position: number;
  width: 'full' | 'half' | 'third';
  height: 'small' | 'medium' | 'large';
  config?: Record<string, unknown>;
  is_visible: boolean;
}

const WIDGET_TYPES = [
  { value: 'status_chart', label: 'Status Distribution', icon: PieChart },
  { value: 'vote_trend', label: 'Vote Trends', icon: TrendingUp },
  { value: 'top_feedback', label: 'Top Feedback', icon: MessageSquare },
  { value: 'sentiment_gauge', label: 'Sentiment Gauge', icon: ThumbsUp },
  { value: 'source_breakdown', label: 'Source Breakdown', icon: BarChart3 },
];

const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'third', label: 'Third Width' },
];

interface WidgetPreviewProps {
  widget: DashboardWidget;
}

function WidgetPreview({ widget }: WidgetPreviewProps) {
  const Icon = WIDGET_TYPES.find((t) => t.value === widget.widget_type)?.icon || BarChart3;

  // Placeholder content for each widget type
  const renderContent = () => {
    switch (widget.widget_type) {
      case 'status_chart':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <PieChart className="w-16 h-16 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">Status Distribution</p>
            </div>
          </div>
        );
      case 'vote_trend':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">Vote Activity Over Time</p>
            </div>
          </div>
        );
      case 'top_feedback':
        return (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-lg font-bold text-muted-foreground">#{i}</div>
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        );
      case 'sentiment_gauge':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">72%</div>
              <p className="text-sm text-muted-foreground">Positive Sentiment</p>
            </div>
          </div>
        );
      case 'source_breakdown':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">Feedback by Source</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const heightClass = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64',
  }[widget.height];

  return (
    <div className={heightClass}>
      {renderContent()}
    </div>
  );
}

export function DashboardWidgets() {
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newWidget, setNewWidget] = useState<Partial<DashboardWidget>>({
    widget_type: 'status_chart',
    width: 'half',
    height: 'medium',
  });

  const { data: widgets = [], isLoading } = useQuery<DashboardWidget[]>({
    queryKey: ['dashboard-widgets', workspace],
    queryFn: () => api<DashboardWidget[]>(`/api/v1/${workspace}/analytics/dashboard`),
  });

  const addWidgetMutation = useMutation({
    mutationFn: async (widget: Partial<DashboardWidget>) =>
      api<DashboardWidget>(`/api/v1/admin/workspaces/${workspace}/widgets`, {
        method: 'POST',
        body: JSON.stringify({
          ...widget,
          position: widgets.length,
          is_visible: true,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', workspace] });
      setIsAddOpen(false);
      setNewWidget({
        widget_type: 'status_chart',
        width: 'half',
        height: 'medium',
      });
      toast({
        title: 'Widget added',
        description: 'Your widget has been added to the dashboard.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add widget',
        variant: 'destructive',
      });
    },
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: async (widgetId: number) =>
      api(`/api/v1/admin/workspaces/${workspace}/widgets/${widgetId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', workspace] });
      toast({
        title: 'Widget removed',
        description: 'The widget has been removed from your dashboard.',
      });
    },
  });

  const getWidthClass = (width: string) => {
    switch (width) {
      case 'full':
        return 'md:col-span-3';
      case 'half':
        return 'md:col-span-2';
      case 'third':
      default:
        return 'md:col-span-1';
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Dashboard Widgets</h3>
        <Button onClick={() => setIsAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Widget
        </Button>
      </div>

      {widgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No widgets yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add widgets to customize your dashboard view
            </p>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Widget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {widgets
            .filter((w) => w.is_visible)
            .sort((a, b) => a.position - b.position)
            .map((widget) => (
              <Card key={widget.id} className={getWidthClass(widget.width)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <CardTitle className="text-sm font-medium">
                      {widget.title ||
                        WIDGET_TYPES.find((t) => t.value === widget.widget_type)?.label}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => deleteWidgetMutation.mutate(widget.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <WidgetPreview widget={widget} />
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget type and configure its display
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Widget Type</Label>
              <Select
                value={newWidget.widget_type}
                onValueChange={(value) =>
                  setNewWidget({ ...newWidget, widget_type: value as DashboardWidget['widget_type'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Custom Title (optional)</Label>
              <Input
                value={newWidget.title || ''}
                onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                placeholder="Leave blank to use default"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Width</Label>
                <Select
                  value={newWidget.width}
                  onValueChange={(value) =>
                    setNewWidget({ ...newWidget, width: value as DashboardWidget['width'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Height</Label>
                <Select
                  value={newWidget.height}
                  onValueChange={(value) =>
                    setNewWidget({ ...newWidget, height: value as DashboardWidget['height'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addWidgetMutation.mutate(newWidget)}
              disabled={addWidgetMutation.isPending}
            >
              {addWidgetMutation.isPending ? 'Adding...' : 'Add Widget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
