import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SpecDraft } from '@/hooks/useSpecDraftsAdmin';
import { Edit, Trash2, Loader2, Film, Search } from 'lucide-react';

interface SpecDraftListProps {
  specDrafts: SpecDraft[];
  onEdit: (specDraft: SpecDraft) => void;
  onDelete: (id: string) => void;
  onManageMovies: (specDraft: SpecDraft) => void;
  onCreateNew?: () => void;
  loading?: boolean;
}

export const SpecDraftList: React.FC<SpecDraftListProps> = ({
  specDrafts,
  onEdit,
  onDelete,
  onManageMovies,
  onCreateNew,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter drafts based on search query
  const filteredDrafts = specDrafts.filter((draft) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      draft.name.toLowerCase().includes(query) ||
      (draft.description && draft.description.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
      {/* Search and Create Button Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 sm:min-w-[294px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-greyscale-blue-400 pointer-events-none z-10" />
            <Input
              placeholder="Search for a Draft"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 h-12 pr-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
              style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
            />
          </div>
        </div>
        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-12 px-6 py-3 rounded-[2px] whitespace-nowrap"
            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
          >
            Create New Draft
          </Button>
        )}
      </div>

      {/* Spec Drafts List */}
      {filteredDrafts.length === 0 ? (
        <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-6 text-center">
          <p 
            className="text-greyscale-blue-600"
            style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
          >
            {searchQuery ? 'No drafts match your search' : 'No spec drafts found. Create one to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDrafts.map((specDraft) => (
            <div
              key={specDraft.id}
              className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-[18px] flex flex-col sm:flex-row gap-4 items-center justify-between"
            >
              {/* Left side: Image, Title, Description */}
              <div className="flex gap-4 items-center flex-1 min-w-0">
                {/* Thumbnail Image */}
                {specDraft.photo_url ? (
                  <img
                    src={specDraft.photo_url}
                    alt={specDraft.name}
                    className="w-12 h-12 sm:w-[72px] sm:h-[72px] min-w-[48px] min-h-[48px] object-cover rounded-[3px]"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-[72px] sm:h-[72px] min-w-[48px] min-h-[48px] bg-greyscale-blue-200 rounded-[3px] flex items-center justify-center">
                    <Film className="w-6 h-6 text-greyscale-blue-400" />
                  </div>
                )}

                {/* Title and Description */}
                <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                  <h3
                    className="text-lg text-[#2b2f31] truncate"
                    style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '18px', lineHeight: '26px' }}
                  >
                    {specDraft.name}
                  </h3>
                  {specDraft.description && (
                    <p
                      className="text-sm text-gray-500 truncate"
                      style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
                    >
                      {specDraft.description}
                </p>
                  )}
                </div>
              </div>

              {/* Right side: Action Icons */}
              <div className="flex gap-2 items-center shrink-0">
                <button
                  onClick={() => onManageMovies(specDraft)}
                  className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                  title="Manage Movies"
                >
                  <Film className="w-6 h-6 text-text-primary" />
                </button>
                <button
                  onClick={() => onEdit(specDraft)}
                  className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-6 h-6 text-text-primary" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${specDraft.name}"?`)) {
                      onDelete(specDraft.id);
                    }
                  }}
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
  );
};

