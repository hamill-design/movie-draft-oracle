import React from 'react';
import { format } from 'date-fns';
import { Calendar, Trophy, Wifi, Monitor, X, Settings } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCleanActorName } from '@/lib/utils';
import type { LeagueDraftEntry } from '@/hooks/useLeagues';

type SpecInfo = { name: string; photo_url: string | null } | undefined;

interface ScheduledDraftDetailModalProps {
  entry: LeagueDraftEntry | null;
  specInfo?: SpecInfo;
  specName?: string;
  isAdmin: boolean;
  leagueId: string;
  open: boolean;
  onClose: () => void;
  onEditSettings: () => void;
}

function entryHeadline(entry: LeagueDraftEntry, specName?: string): string {
  const t = entry.draft_type;
  if (t === 'spec-draft') return specName ?? entry.theme?.trim() ?? 'Special Draft';
  if (t === 'filmography' || t === 'people') {
    return getCleanActorName(entry.theme ?? '') || entry.theme?.trim() || 'Draft';
  }
  if (t === 'year') return entry.theme?.trim() || 'Draft';
  return entry.theme?.trim() || 'Draft';
}

const DRAFT_TYPE_LABEL: Record<string, string> = {
  filmography: 'By Filmography',
  people: 'By Filmmaker',
  year: 'By Year',
  'spec-draft': 'Special Draft',
  classic: 'Classic Draft',
};

export const ScheduledDraftDetailModal: React.FC<ScheduledDraftDetailModalProps> = ({
  entry,
  specName,
  isAdmin,
  open,
  onClose,
  onEditSettings,
}) => {
  if (!entry) return null;

  const headline = entryHeadline(entry, specName);
  const scheduledDate = entry.scheduled_at ? new Date(entry.scheduled_at) : null;
  const typeLabel = DRAFT_TYPE_LABEL[entry.draft_type ?? ''] ?? entry.draft_type ?? 'Draft';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-[520px] rounded-lg border-0 p-0 font-brockmann"
        style={{ background: '#0E0E0F', boxShadow: '0px 0px 24px rgba(59,3,148,0.6)' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-greyscale-blue-400 transition-colors hover:bg-white/10 hover:text-greyscale-blue-100"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col gap-0">
          {/* Header */}
          <div className="px-6 pb-4 pt-6">
            <DialogHeader>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={
                    entry.is_multiplayer
                      ? { background: 'rgba(20,84,96,0.6)', outline: '0.5px solid #B2FFEA', outlineOffset: '-0.5px', color: '#B2FFEA' }
                      : { background: 'rgba(88,40,120,0.6)', outline: '0.5px solid #EDEBFF', outlineOffset: '-0.5px', color: '#EDEBFF' }
                  }
                >
                  {entry.is_multiplayer
                    ? <><Wifi size={10} />Multiplayer</>
                    : <><Monitor size={10} />Local</>}
                </span>
                <span className="text-[10px] font-medium text-greyscale-blue-400">{typeLabel}</span>
              </div>
              <DialogTitle className="m-0 text-left text-xl font-bold leading-7 text-greyscale-blue-100">
                {headline}
              </DialogTitle>
              {scheduledDate && (
                <DialogDescription className="m-0 mt-1 text-left text-sm text-[#907AFF]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} />
                    {format(scheduledDate, "EEEE, MMMM d 'at' h:mm a")}
                  </span>
                </DialogDescription>
              )}
            </DialogHeader>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-white/10" />

          {/* Body */}
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Categories */}
            {entry.categories && entry.categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-greyscale-blue-400">
                  <Trophy size={12} />
                  Categories
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.categories.map(cat => (
                    <span
                      key={cat}
                      className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs text-greyscale-blue-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {entry.notes && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-greyscale-blue-400">
                  Notes
                </div>
                <p className="m-0 text-sm italic text-greyscale-blue-300">{entry.notes}</p>
              </div>
            )}

            {/* No details */}
            {(!entry.categories || entry.categories.length === 0) && !entry.notes && (
              <p className="m-0 text-sm text-greyscale-blue-500">No additional details.</p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-white/10" />

          {/* Footer actions */}
          <div className="flex items-center justify-between px-6 py-4">
            {isAdmin ? (
              <button
                type="button"
                onClick={onEditSettings}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-greyscale-blue-400 transition-colors hover:text-greyscale-blue-100"
              >
                <Settings size={14} />
                Edit in Settings
              </button>
            ) : (
              <div />
            )}
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-[2px] border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-greyscale-blue-200 hover:bg-white/10 hover:text-greyscale-blue-100"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
