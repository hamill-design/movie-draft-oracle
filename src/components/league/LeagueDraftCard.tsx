import React from 'react';
import { Calendar, Trophy, Users, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { cn, getCleanActorName } from '@/lib/utils';
import { format } from 'date-fns';
import type { LeagueDraftEntry } from '@/hooks/useLeagues';
import { placementOrdinalLabel } from '@/lib/leagueDraftMetrics';

type SpecInfo = { name: string; photo_url: string | null } | undefined;

function themeTitle(entry: LeagueDraftEntry, spec: SpecInfo): string {
  const opt = entry.draft?.option ?? '';
  const theme = entry.draft?.theme ?? '';
  if (theme === 'spec-draft') return spec?.name || opt || entry.draft?.title || 'Draft';
  if (theme === 'people') return getCleanActorName(opt) || entry.draft?.title || 'Draft';
  if (theme === 'year') return opt || entry.draft?.title || 'Draft';
  return entry.draft?.title || opt || 'Draft';
}

export type LeagueDraftCardProps = {
  entry: LeagueDraftEntry;
  /** When set (e.g. scheduled rows without a linked draft row), overrides theme-based title */
  headline?: string;
  specInfo?: SpecInfo;
  participantCount: number;
  /** Uses league_drafts.categories or draft.categories */
  categoriesCount: number;
  /** Scheduled row uses scheduled_at; linked draft uses draft.created_at */
  displayDate: Date | null;
  isScheduled: boolean;
  isComplete: boolean;
  isMultiplayer: boolean;
  onView: () => void;
  /** 1-based; null = hide placement row (scheduled / not a participant) */
  placementRank?: number | null;
  /** Positive = moved up in league standings */
  rankDelta?: number | null;
  viewLabel: string;
  /** Scheduled rows only: when false, primary action is disabled (non-admins). Defaults to true. */
  canEditSchedule?: boolean;
  /** Disable the primary action button (e.g. while async action is in flight) */
  viewDisabled?: boolean;
  /** Scheduled rows: non-admin callback to view details / navigate to lobby */
  onDetails?: () => void;
  /** Admin-only: opens the delete confirmation dialog */
  onDelete?: () => void;
};

const cardShell =
  'w-full p-6 bg-greyscale-purp-850 rounded-lg flex justify-between items-center flex-wrap gap-4';

const placementBadgeClass = (rank: number) =>
  rank === 1
    ? 'size-8 shrink-0 rounded-full bg-[#FFD60A] text-base font-bold leading-6 text-[#1D1D1F] outline outline-2 -outline-offset-2 outline-[#FFF2B2] font-brockmann flex items-center justify-center tabular-nums'
    : 'size-8 shrink-0 rounded-full bg-[#907AFF] text-base font-bold leading-6 text-[#0E0F0F] font-brockmann flex items-center justify-center tabular-nums';

export const LeagueDraftCard: React.FC<LeagueDraftCardProps> = ({
  entry,
  headline,
  specInfo,
  participantCount,
  categoriesCount,
  displayDate,
  isScheduled,
  isComplete,
  isMultiplayer,
  onView,
  placementRank,
  rankDelta,
  viewLabel,
  canEditSchedule = true,
  viewDisabled = false,
  onDetails,
  onDelete,
}) => {
  const theme = entry.draft?.theme ?? '';
  const scheduleType = entry.draft_type;
  const hasLinkedDraft = !!entry.draft;
  /** Scheduled league rows store filmography on draft_type + theme; linked drafts use draft.theme === 'people'. */
  const showSpecPortrait =
    theme === 'spec-draft' || (!hasLinkedDraft && scheduleType === 'spec-draft');
  const showActorPortrait =
    theme === 'people' ||
    (!hasLinkedDraft && (scheduleType === 'filmography' || scheduleType === 'people'));
  const showYearPlaceholder =
    theme === 'year' || (!hasLinkedDraft && scheduleType === 'year');
  const actorNameForPortrait = getCleanActorName(entry.draft?.option ?? entry.theme ?? '');

  const title = headline ?? themeTitle(entry, specInfo);

  const showPlacement =
    !isScheduled && placementRank != null && placementRank > 0;
  const showDelta =
    showPlacement && isComplete && rankDelta != null && rankDelta !== 0;

  // Show right column if: non-scheduled (always), admin on scheduled, or non-admin with onDetails handler
  const showSchedulePrimary = !isScheduled || canEditSchedule || !!onDetails;
  const showRightColumn = showPlacement || showSchedulePrimary;

  const deltaText = rankDelta == null || rankDelta === 0 ? null : rankDelta > 0 ? `+${rankDelta}` : `${rankDelta}`;

  return (
    <div className={cardShell} style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', outline: '1px solid #49474B', outlineOffset: '-1px' }}>
      <div className="flex min-w-[240px] flex-1 flex-col items-start justify-start gap-4">
        <div className="inline-flex items-start justify-start gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[4px]">
            {showSpecPortrait ? (
              specInfo?.photo_url ? (
                <img
                  src={specInfo.photo_url}
                  alt={specInfo.name || 'Spec draft'}
                  className="h-14 w-14 rounded-[4px] object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-greyscale-purp-800">
                  <User size={24} className="text-greyscale-blue-300" />
                </div>
              )
            ) : showActorPortrait ? (
              <DraftActorPortrait
                actorName={actorNameForPortrait}
                size="lg"
                className="h-14 w-14 rounded-[4px] object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-greyscale-purp-800">
                {showYearPlaceholder ? (
                  <Calendar size={24} className="text-greyscale-blue-300" />
                ) : (
                  <User size={24} className="text-greyscale-blue-300" />
                )}
              </div>
            )}
          </div>

          <div className="inline-flex max-w-[244px] flex-col items-start justify-start gap-2">
            <div className="flex flex-col items-start justify-start">
              <div className="flex flex-col justify-center text-lg font-semibold leading-6 text-greyscale-blue-100 font-brockmann">
                {title}
              </div>
            </div>
            <div className="inline-flex min-h-6 flex-wrap items-start justify-start gap-1.5 self-stretch">
              {isMultiplayer ? (
                <div
                  className="flex items-center justify-start rounded-full bg-teal-900 px-3 py-1"
                  style={{ outline: '0.50px solid #B2FFEA', outlineOffset: '-0.50px' }}
                >
                  <span className="text-xs font-semibold leading-4 text-teal-200 font-brockmann">Multiplayer</span>
                </div>
              ) : (
                <div
                  className="flex items-center justify-start rounded-full bg-purple-800 px-3 py-1"
                  style={{ outline: '0.50px solid #EDEBFF', outlineOffset: '-0.50px' }}
                >
                  <span className="text-xs font-semibold leading-4 text-purple-100 font-brockmann">Local</span>
                </div>
              )}
              {isComplete && (
                <div className="flex items-center justify-start rounded-full bg-teal-500 px-3 py-1">
                  <span className="text-xs font-semibold leading-4 text-greyscale-purp-850 font-brockmann">Complete</span>
                </div>
              )}
              {!isComplete && !isScheduled && (
                <div className="flex items-center justify-start rounded-full bg-amber-500/20 px-3 py-1 outline outline-1 outline-amber-500/40">
                  <span className="text-xs font-semibold leading-4 text-amber-200 font-brockmann">In progress</span>
                </div>
              )}
              {isScheduled && (
                <div className="flex items-center justify-start rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1">
                  <span className="text-xs font-semibold leading-4 text-purple-200 font-brockmann">Scheduled</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center justify-start gap-4 self-stretch">
          {displayDate && (
            <div className="flex items-center justify-start gap-1">
              <Calendar size={16} className="text-greyscale-blue-300" />
              <span className="text-sm font-medium leading-5 text-greyscale-blue-300 font-brockmann">
                {displayDate.toLocaleDateString()}
              </span>
            </div>
          )}
          {isScheduled && entry.scheduled_at && (
            <div className="flex items-center justify-start gap-1">
              <span className="text-sm font-medium leading-5 text-greyscale-blue-300 font-brockmann">
                {format(new Date(entry.scheduled_at), 'h:mm a')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-start gap-1">
            <Users size={16} className="text-greyscale-blue-300" />
            <span className="text-sm font-medium leading-5 text-greyscale-blue-300 font-brockmann">
              {participantCount} {participantCount === 1 ? 'player' : 'players'}
            </span>
          </div>
          <div className="flex items-center justify-start gap-1">
            <Trophy size={16} className="text-greyscale-blue-300" />
            <span className="text-sm font-medium leading-5 text-greyscale-blue-300 font-brockmann">
              {categoriesCount} {categoriesCount === 1 ? 'category' : 'categories'}
            </span>
          </div>
        </div>

        {entry.categories?.length > 0 && isScheduled && (
          <div className="flex flex-wrap gap-1.5 self-start">
            {entry.categories.map(cat => (
              <span
                key={cat}
                className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-brockmann text-greyscale-blue-300"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
        {entry.notes && isScheduled && (
          <p className="m-0 text-xs italic text-greyscale-blue-500 font-brockmann">{entry.notes}</p>
        )}
      </div>

      {showRightColumn && (
      <div
        className={cn(
          'inline-flex min-w-[240px] max-w-[360px] flex-1 flex-col items-end',
          showPlacement ? 'min-h-[90px] justify-between' : 'justify-end',
        )}
      >
        {showPlacement && placementRank != null && (
          <div className="mb-3 inline-flex w-full flex-wrap items-center justify-end gap-3 sm:justify-between">
            <div className="inline-flex items-center gap-3">
              <div className={placementBadgeClass(placementRank)} aria-hidden>
                {placementRank}
              </div>
              <div className="flex flex-col justify-center text-base font-semibold leading-6 tracking-wide text-greyscale-blue-100 font-brockmann">
                {placementOrdinalLabel(placementRank)}
              </div>
            </div>
            {showDelta && deltaText && (
              <div className="flex flex-col items-end justify-start">
                <div
                  className={cn(
                    'text-right text-[32px] font-bold leading-9 tracking-wide font-brockmann',
                    rankDelta != null && rankDelta > 0 ? 'text-[#907AFF]' : 'text-red-400',
                  )}
                >
                  {deltaText}
                </div>
              </div>
            )}
          </div>
        )}

        {showSchedulePrimary && (
        <Button
          type="button"
          onClick={isScheduled && !canEditSchedule && onDetails ? onDetails : onView}
          disabled={viewDisabled}
          variant="default"
          size="default"
          className="w-full max-w-[360px] self-end rounded-[2px] bg-brand-primary px-4 py-2 text-greyscale-blue-100 hover:bg-purple-300 disabled:opacity-60"
        >
          {isScheduled && !canEditSchedule ? 'View Details' : viewLabel}
        </Button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete from league history"
            className="mt-1 inline-flex items-center gap-1.5 self-end text-xs text-greyscale-blue-500 transition-colors hover:text-red-400 font-brockmann"
          >
            <Trash2 size={13} />
            Remove from league
          </button>
        )}
      </div>
      )}
    </div>
  );
};
