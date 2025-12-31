import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getApiKey } from '@/lib/api';
import { getWorkspace, setWorkspace, getBoard, setBoard } from '@/lib/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Copy, Check, Settings as SettingsIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceStats {
  total_feedback: number;
  total_votes: number;
  total_users: number;
  boards_count: number;
}


export default function Settings() {
  const { toast } = useToast();
  const [workspace, setWorkspaceState] = useState(getWorkspace());
  const [board, setBoardState] = useState(getBoard());
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch workspace stats (we'll need to add this endpoint later)
  const { data: stats } = useQuery<WorkspaceStats>({
    queryKey: ['workspace-stats', workspace],
    queryFn: async () => {
      try {
        return await api(`/api/v1/${workspace}/main/admin/stats`);
      } catch (error) {
        // Stats endpoint might not exist yet, return defaults
        return {
          total_feedback: 0,
          total_votes: 0,
          total_users: 0,
          boards_count: 0,
        };
      }
    },
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleWorkspaceChange = () => {
    setWorkspace(workspace);
    toast({
      title: 'Workspace updated',
      description: `Now using workspace: ${workspace}`,
    });
  };

  const handleBoardChange = () => {
    setBoard(board);
    toast({
      title: 'Board updated',
      description: `Now using board: ${board}`,
    });
  };

  const apiKey = getApiKey() || '';
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${'*'.repeat(16)}` : 'Not set';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your workspace configuration and API access
        </p>
      </div>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="api">API Access</TabsTrigger>
          <TabsTrigger value="boards">Boards</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Information</CardTitle>
              <CardDescription>
                Current workspace configuration and statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Workspace Slug</Label>
                  <p className="text-lg font-semibold">{workspace}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Active Board</Label>
                  <p className="text-lg font-semibold">{board}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-gray-500">Total Feedback</Label>
                  <p className="text-2xl font-bold">{stats?.total_feedback ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-500">Total Votes</Label>
                  <p className="text-2xl font-bold">{stats?.total_votes ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-500">Total Users</Label>
                  <p className="text-2xl font-bold">{stats?.total_users ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-500">Boards</Label>
                  <p className="text-2xl font-bold">{stats?.boards_count ?? 0}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-input">Change Workspace</Label>
                  <div className="flex gap-2">
                    <Input
                      id="workspace-input"
                      value={workspace}
                      onChange={(e) => setWorkspaceState(e.target.value)}
                      placeholder="Enter workspace slug"
                    />
                    <Button onClick={handleWorkspaceChange}>Update</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="board-input">Change Default Board</Label>
                  <div className="flex gap-2">
                    <Input
                      id="board-input"
                      value={board}
                      onChange={(e) => setBoardState(e.target.value)}
                      placeholder="Enter board slug"
                    />
                    <Button onClick={handleBoardChange}>Update</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>
                Your API key for authenticating with the Collective Vision API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input value={maskedKey} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(apiKey, 'API Key')}
                  >
                    {copied === 'API Key' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Keep this key secure. It provides full access to your workspace.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>API Base URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      handleCopy(
                        import.meta.env.VITE_API_URL || 'http://localhost:8787',
                        'API URL'
                      )
                    }
                  >
                    {copied === 'API URL' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Widget Embed Code</Label>
                <div className="space-y-2">
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`<script
  src="${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/widget.js"
  data-workspace="${workspace}"
  data-board="${board}"
></script>`}</code>
                  </pre>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleCopy(
                        `<script src="${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/widget.js" data-workspace="${workspace}" data-board="${board}"></script>`,
                        'Embed code'
                      )
                    }
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Embed Code
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Board Management</CardTitle>
              <CardDescription>
                Manage feedback boards for this workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Boards are created automatically when you submit feedback to a new board slug.
                  You can also create boards programmatically via the API.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Tip:</strong> Use different board slugs to organize feedback by
                    product area, feature, or team. For example: "mobile-app", "web-platform",
                    "api-feedback".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
