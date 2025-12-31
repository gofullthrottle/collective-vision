import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tag as TagIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: number;
  workspace_id: number;
  name: string;
  color: string;
  created_at: string;
  usage_count: number;
}

interface TagsResponse {
  tags: Tag[];
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#14b8a6', // teal
];

export default function Tags() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');

  // Fetch tags
  const { data, isLoading } = useQuery<TagsResponse>({
    queryKey: ['tags', workspace],
    queryFn: () => api(`/api/v1/admin/workspaces/${workspace}/tags`),
  });

  // Create tag mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      api(`/api/v1/admin/workspaces/${workspace}/tags`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspace] });
      setIsCreateOpen(false);
      setNewTagName('');
      setNewTagColor(DEFAULT_COLORS[0]);
      toast({
        title: 'Tag created',
        description: 'The tag has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tag',
        variant: 'destructive',
      });
    },
  });

  // Update tag mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; color?: string } }) =>
      api(`/api/v1/admin/workspaces/${workspace}/tags/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspace] });
      setIsEditOpen(false);
      setSelectedTag(null);
      toast({
        title: 'Tag updated',
        description: 'The tag has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update tag',
        variant: 'destructive',
      });
    },
  });

  // Delete tag mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/workspaces/${workspace}/tags/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspace] });
      setIsDeleteOpen(false);
      setSelectedTag(null);
      toast({
        title: 'Tag deleted',
        description: 'The tag has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete tag',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!newTagName.trim()) {
      toast({
        title: 'Error',
        description: 'Tag name is required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTag) return;
    if (!editTagName.trim()) {
      toast({
        title: 'Error',
        description: 'Tag name is required',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate({
      id: selectedTag.id,
      data: { name: editTagName.trim(), color: editTagColor },
    });
  };

  const handleDeleteClick = (tag: Tag) => {
    setSelectedTag(tag);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!selectedTag) return;
    deleteMutation.mutate(selectedTag.id);
  };

  const tags = data?.tags || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TagIcon className="w-8 h-8" />
            Tags
          </h1>
          <p className="text-gray-500 mt-1">
            Organize and categorize feedback with tags
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Tag
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
          <CardDescription>
            Manage tags for your workspace. Tags can be used to categorize feedback items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading tags...</div>
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <TagIcon className="w-12 h-12 mb-2 opacity-50" />
              <p>No tags yet</p>
              <p className="text-sm">Create your first tag to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Badge style={{ backgroundColor: tag.color }} className="text-white">
                        {tag.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: tag.color }}
                        />
                        <code className="text-sm">{tag.color}</code>
                      </div>
                    </TableCell>
                    <TableCell>{tag.usage_count}</TableCell>
                    <TableCell>{new Date(tag.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(tag)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(tag)}
                          disabled={tag.usage_count > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Add a new tag to organize your feedback items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., bug, feature, enhancement"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded border-2 transition-all ${
                      newTagColor === color ? 'border-black dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color">Custom:</Label>
                <input
                  id="custom-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <code className="text-sm">{newTagColor}</code>
              </div>
            </div>
            <div className="pt-2">
              <Label>Preview</Label>
              <div className="mt-2">
                <Badge style={{ backgroundColor: newTagColor }} className="text-white">
                  {newTagName || 'Tag Name'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name or color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input
                id="edit-tag-name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="e.g., bug, feature, enhancement"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded border-2 transition-all ${
                      editTagColor === color ? 'border-black dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditTagColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="edit-custom-color">Custom:</Label>
                <input
                  id="edit-custom-color"
                  type="color"
                  value={editTagColor}
                  onChange={(e) => setEditTagColor(e.target.value)}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <code className="text-sm">{editTagColor}</code>
              </div>
            </div>
            <div className="pt-2">
              <Label>Preview</Label>
              <div className="mt-2">
                <Badge style={{ backgroundColor: editTagColor }} className="text-white">
                  {editTagName || 'Tag Name'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedTag && (
            <div className="py-4">
              <Badge style={{ backgroundColor: selectedTag.color }} className="text-white">
                {selectedTag.name}
              </Badge>
              {selectedTag.usage_count > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  This tag is currently used by {selectedTag.usage_count} feedback item(s).
                  Deleting it will remove it from all feedback items.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
