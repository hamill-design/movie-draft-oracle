import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SpecDraft } from '@/hooks/useSpecDraftsAdmin';

interface SpecDraftFormProps {
  specDraft?: SpecDraft | null;
  onSubmit: (data: {
    name: string;
    description?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const SpecDraftForm: React.FC<SpecDraftFormProps> = ({
  specDraft,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [name, setName] = useState(specDraft?.name || '');
  const [description, setDescription] = useState(specDraft?.description || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Spec draft name is required');
      return;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {specDraft ? 'Edit Spec Draft' : 'Create New Spec Draft'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Spec Draft Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Action Blockbusters 2020s"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A curated collection of action blockbusters from the 2020s"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : specDraft ? 'Update Spec Draft' : 'Create Spec Draft'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

