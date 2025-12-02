import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { SpecDraftCategory } from '@/hooks/useSpecDraftsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SpecDraftCategoriesManagerProps {
  specDraftId: string;
  customCategories: SpecDraftCategory[];
  onCreate: (categoryName: string, description?: string) => Promise<void>;
  onUpdate: (id: string, updates: { category_name?: string; description?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export const SpecDraftCategoriesManager: React.FC<SpecDraftCategoriesManagerProps> = ({
  specDraftId,
  customCategories,
  onCreate,
  onUpdate,
  onDelete,
  loading = false,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  // Debug: Log custom categories when they change
  useEffect(() => {
    console.log(`SpecDraftCategoriesManager: Received ${customCategories.length} custom categories for draft ${specDraftId}`);
    if (customCategories.length > 0) {
      console.log('Categories:', customCategories.map(c => c.category_name));
    }
  }, [customCategories, specDraftId]);

  const handleCreate = async () => {
    if (!categoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onCreate(categoryName.trim(), description.trim() || undefined);
      setCategoryName('');
      setDescription('');
      setIsCreating(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleUpdate = async (id: string) => {
    if (!categoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onUpdate(id, {
        category_name: categoryName.trim(),
        description: description.trim() || null,
      });
      setEditingId(null);
      setCategoryName('');
      setDescription('');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleEdit = (category: SpecDraftCategory) => {
    setEditingId(category.id);
    setCategoryName(category.category_name);
    setDescription(category.description || '');
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setCategoryName('');
    setDescription('');
    setIsCreating(false);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setCategoryToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    
    try {
      await onDelete(categoryToDelete.id);
    } catch (error) {
      // Error already handled in hook
    } finally {
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Categories</CardTitle>
            {!isCreating && !editingId && (
              <Button
                size="sm"
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                  setCategoryName('');
                  setDescription('');
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Create/Edit Form */}
            {(isCreating || editingId) && (
              <div className="p-4 border rounded-lg bg-greyscale-blue-100">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Category Name *</Label>
                    <Input
                      id="category-name"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g., Superhero Movies"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category-description">Description (Optional)</Label>
                    <Textarea
                      id="category-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Movies featuring superhero characters"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancel} disabled={loading}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Categories List */}
            {customCategories.length === 0 && !isCreating && !editingId ? (
              <p className="text-sm text-greyscale-blue-500 text-center py-4">
                No custom categories yet. Click "Add Category" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {customCategories.length > 0 && (
                  <div className="text-xs text-greyscale-blue-500 mb-2">
                    Showing {customCategories.length} custom categor{customCategories.length === 1 ? 'y' : 'ies'}
                  </div>
                )}
                {customCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-start justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">{category.category_name}</div>
                      {category.description && (
                        <div className="text-sm text-greyscale-blue-500 mt-1">{category.description}</div>
                      )}
                    </div>
                    {editingId !== category.id && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          disabled={loading}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(category.id, category.category_name)}
                          disabled={loading}
                          className="text-error-red-600 hover:text-error-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the custom category "{categoryToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-error-red-600 hover:bg-error-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
