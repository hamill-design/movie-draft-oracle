import React, { useState } from 'react';
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

  // Debug: Log custom categories when they change
  React.useEffect(() => {
    console.log(`📋 SpecDraftCategoriesManager: Received ${customCategories.length} custom categories for draft ${specDraftId}`);
    if (customCategories.length > 0) {
      console.log('Categories:', customCategories.map(c => c.category_name));
    }
  }, [customCategories, specDraftId]);

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
    <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-brockmann-semibold text-text-primary leading-6 tracking-[0.32px]">
          Custom Categories
        </h3>
        {!isCreating && !editingId && (
          <Button
            size="sm"
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setCategoryName('');
              setDescription('');
            }}
            className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-10 px-4 py-2 rounded-[2px] font-brockmann-semibold text-sm leading-5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {/* Create/Edit Form */}
        {(isCreating || editingId) && (
          <div className="p-4 border border-greyscale-blue-200 rounded-lg bg-ui-primary">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name" className="text-sm font-brockmann-medium text-text-primary leading-5">
                  Category Name *
                </Label>
                <Input
                  id="category-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g., Superhero Movies"
                  required
                  className="h-12 border-greyscale-blue-400 text-sm font-brockmann-medium leading-5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-description" className="text-sm font-brockmann-medium text-text-primary leading-5">
                  Description (Optional)
                </Label>
                <Textarea
                  id="category-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Movies featuring superhero characters"
                  rows={2}
                  className="border-greyscale-blue-400 text-sm font-brockmann-regular leading-5"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                  className="h-10 px-4 border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 font-brockmann-medium text-sm leading-5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                  disabled={loading}
                  className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-10 px-4 py-2 rounded-[2px] font-brockmann-semibold text-sm leading-5"
                >
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Categories List */}
        {customCategories.length === 0 && !isCreating && !editingId ? (
          <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-6 text-center">
            <p className="text-sm font-brockmann-regular text-greyscale-blue-600 leading-5">
              No custom categories yet. Click "Add Category" to create one.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customCategories.length > 0 && (
              <div className="text-xs font-brockmann-regular text-greyscale-blue-600 leading-4 mb-2">
                Showing {customCategories.length} custom categor{customCategories.length === 1 ? 'y' : 'ies'}
              </div>
            )}
            {customCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-start justify-between p-3 border border-greyscale-blue-200 rounded-[8px] bg-ui-primary hover:shadow-sm transition-shadow"
              >
                <div className="flex-1">
                  <div className="text-base font-brockmann-semibold text-text-primary leading-6 tracking-[0.32px]">
                    {category.category_name}
                  </div>
                  {category.description && (
                    <div className="text-sm font-brockmann-regular text-greyscale-blue-600 leading-5 mt-1">
                      {category.description}
                    </div>
                  )}
                </div>
                {editingId !== category.id && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(category)}
                      disabled={loading}
                      className="h-8 px-3 border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 font-brockmann-medium text-sm leading-5"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(category.id, category.category_name)}
                      disabled={loading}
                      className="h-8 px-3 border-greyscale-blue-200 text-red-600 hover:text-red-700 hover:bg-red-50 font-brockmann-medium text-sm leading-5"
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
    </div>
  );
};
