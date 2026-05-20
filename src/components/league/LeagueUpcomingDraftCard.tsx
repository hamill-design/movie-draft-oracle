import React from 'react';
import { Calendar, Trophy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';
import { format } from 'date-fns';
import type { LeagueDraftEntry } from '@/hooks/useLeagues';

type SpecInfo = { name: string; photo_url: string | null } | undefined;

export type LeagueUpcomingDraftCardProps = {
  entry: LeagueDraftEntry;
  headline: string;
  specInfo?: SpecInfo;
  onEdit: () => void;
  /** When false, edit control is hidden (e.g. non-admin). Defaults to true. */
  canEdit?: boolean;
};

const cardShell =
  'w-full p-6 bg-greyscale-purp-850 rounded-lg inline-flex flex-wrap items-center justify-start gap-3';

export const LeagueUpcomingDraftCard: React.FC<LeagueUpcomingDraftCardProps> = ({
  entry,
  headline,
  specInfo,
  onEdit,
  canEdit = true,
}) => {
  const dt = entry.scheduled_at ? new Date(entry.scheduled_at) : null;
  const datetimeStr = dt
    ? format(dt, "M/d/yyyy '@' h:mm a")
    : null;
  const categoriesCount = entry.categories?.length ?? 0;
  const draftType = entry.draft_type ?? '';

  return (
    <div
      className={cardShell}
      style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', outline: '1px solid #49474B', outlineOffset: '-1px' }}
    >
      <div className="flex min-w-[240px] flex-1 flex-col items-start justify-start gap-4">
        <div className="inline-flex items-start justify-start gap-3 self-stretch">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[4px]">
            {draftType === 'spec-draft' ? (
              specInfo?.photo_url ? (
                <img
                  src={specInfo.photo_url}
                  alt={specInfo.name || 'Special draft'}
                  className="h-14 w-14 rounded-[4px] object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-greyscale-purp-800">
                  <User size={24} className="text-greyscale-blue-300" />
                </div>
              )
            ) : draftType === 'people' || draftType === 'filmography' ? (
              <DraftActorPortrait
                actorName={getCleanActorName(entry.draft?.option ?? entry.theme ?? '')}
                size="lg"
                className="h-14 w-14 rounded-[4px] object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-greyscale-purp-800">
                {draftType === 'year' ? (
                  <Calendar size={24} className="text-greyscale-blue-300" />
                ) : (
                  <User size={24} className="text-greyscale-blue-300" />
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-2">
            <div className="flex flex-col items-start justify-start">
              <div className="flex flex-col justify-center text-lg font-semibold leading-6 text-greyscale-blue-100 font-brockmann">
                {headline}
              </div>
            </div>

            <div className="inline-flex flex-wrap items-center justify-start gap-4 self-stretch">
              {datetimeStr && (
                <div className="flex items-center justify-start gap-1">
                  <Calendar size={16} className="shrink-0 text-[#907AFF]" />
                  <span className="text-sm font-medium leading-5 text-[#907AFF] font-brockmann">
                    {datetimeStr}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-start gap-1">
                <Trophy size={16} className="shrink-0 text-greyscale-blue-300" />
                <span className="text-sm font-medium leading-5 text-greyscale-blue-300 font-brockmann">
                  {categoriesCount} {categoriesCount === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {entry.categories && entry.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 self-start">
            {entry.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-brockmann text-greyscale-blue-300"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {entry.notes && (
          <p className="m-0 max-w-full text-xs italic text-greyscale-blue-500 font-brockmann">{entry.notes}</p>
        )}
      </div>

      {canEdit && (
      <div className="flex max-w-[360px] min-w-[240px] flex-col items-end justify-start gap-[18px]">
        <Button
          type="button"
          onClick={onEdit}
          variant="default"
          className="w-full self-stretch rounded-[2px] bg-brand-primary px-4 py-2 text-sm font-medium text-greyscale-blue-100 hover:bg-purple-300"
        >
          Edit Draft
        </Button>
      </div>
      )}
    </div>
  );
};
