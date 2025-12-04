import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit2, Trash2 } from 'lucide-react';
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
    <>
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-xl text-text-primary"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px' }}
          >
            Custom Categories
          </h3>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setCategoryName('');
              setDescription('');
            }}
            className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 px-3 py-2 rounded-[2px] flex items-center gap-2"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px', lineHeight: '20px' }}
          >
            <Plus className="w-4 h-4" />
            Create Category
          </Button>
        </div>

        {/* Categories List */}
        {customCategories.length === 0 ? (
          <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-6 text-center">
            <p
              className="text-greyscale-blue-600"
              style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
            >
              No custom categories yet. Click "Create Category" to add one.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {customCategories.map((category) => (
              <div
                key={category.id}
                className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] px-[18px] py-4 flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-[2px] flex-1 min-w-0">
                  <h4
                    className="text-lg text-[#2b2f31] truncate"
                    style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '18px', lineHeight: '26px' }}
                  >
                    {category.category_name}
                  </h4>
                  {category.description && (
                    <p
                      className="text-sm text-gray-500 truncate"
                      style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
                    >
                      {category.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(category)}
                    disabled={loading}
                    className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-6 h-6 text-text-primary" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.category_name)}
                    disabled={loading}
                    className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-6 h-6 text-text-primary" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || editingId !== null} onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Custom Category' : 'Create Custom Category'}
            </DialogTitle>
          </DialogHeader>
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
                rows={3}
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
        </DialogContent>
      </Dialog>
    </>
  );
};

