import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpecDraft } from '@/hooks/useSpecDraftsAdmin';
import { Edit, Trash2, Loader2, Film } from 'lucide-react';

interface SpecDraftListProps {
  specDrafts: SpecDraft[];
  onEdit: (specDraft: SpecDraft) => void;
  onDelete: (id: string) => void;
  onManageMovies: (specDraft: SpecDraft) => void;
  loading?: boolean;
}

export const SpecDraftList: React.FC<SpecDraftListProps> = ({
  specDrafts,
  onEdit,
  onDelete,
  onManageMovies,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (specDrafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No spec drafts found. Create one to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {specDrafts.map((specDraft) => (
        <Card key={specDraft.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{specDraft.name}</CardTitle>
                {specDraft.description && (
                  <p className="text-sm text-gray-600 mt-1">{specDraft.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Created: {new Date(specDraft.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageMovies(specDraft)}
                >
                  <Film className="w-4 h-4 mr-2" />
                  Manage Movies
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(specDraft)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${specDraft.name}"?`)) {
                      onDelete(specDraft.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};

