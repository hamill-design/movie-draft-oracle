import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
import { SpecDraftCategory } from '@/hooks/useSpecDraftsAdmin';

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

  const handleCreate = async () => {
    if (!categoryName.trim()) {
      alert('Category name is required');
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
      alert('Category name is required');
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

  const handleDelete = async (id: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the custom category "${categoryName}"?`)) {
      return;
    }

    try {
      await onDelete(id);
    } catch (error) {
      // Error already handled in hook
    }
  };

  return (
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
            <div className="p-4 border rounded-lg bg-gray-50">
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
            <p className="text-sm text-gray-500 text-center py-4">
              No custom categories yet. Click "Add Category" to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {customCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{category.category_name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500 mt-1">{category.description}</div>
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
                        onClick={() => handleDelete(category.id, category.category_name)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
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
  );
};

