import React from 'react';
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
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
        <div className="text-center text-greyscale-blue-600 font-brockmann-regular text-sm leading-5">
          Loading spec drafts...
        </div>
      </div>
    );
  }

  if (specDrafts.length === 0) {
    return (
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
        <div className="text-center py-12 text-greyscale-blue-600 font-brockmann-regular text-sm leading-5">
          No spec drafts found. Create one to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-4">
      {specDrafts.map((specDraft) => (
        <div
          key={specDraft.id}
          className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-brockmann-semibold text-text-primary leading-6 tracking-[0.32px]">
                {specDraft.name}
              </h3>
              {specDraft.description && (
                <p className="text-sm font-brockmann-regular text-greyscale-blue-600 leading-5 mt-1">
                  {specDraft.description}
                </p>
              )}
              <p className="text-xs font-brockmann-regular text-greyscale-blue-400 leading-4 mt-2">
                Created: {new Date(specDraft.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageMovies(specDraft)}
                className="h-8 px-3 border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 font-brockmann-medium text-sm leading-5"
              >
                <Film className="w-4 h-4 mr-2" />
                Manage Movies
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(specDraft)}
                className="h-8 px-3 border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 font-brockmann-medium text-sm leading-5"
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
                className="h-8 px-3 border-greyscale-blue-200 text-red-600 hover:text-red-700 hover:bg-red-50 font-brockmann-medium text-sm leading-5"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
