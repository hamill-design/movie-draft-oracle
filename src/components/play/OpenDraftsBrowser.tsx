import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { OpenGamesList } from '@/components/home/OpenGamesList';
import type { OpenGameRow, TableSpeed } from '@/lib/publicPlayApi';

interface OpenDraftsBrowserProps {
  /** The drafts waiting for players. The page loads them (`useOpenGames`) so it can hold its loading screen until they are in. */
  games: OpenGameRow[] | null;
  /** Fetches the list again (the refresh button). */
  reload: () => void | Promise<void>;
  /** Can this visitor join straight away (signed in, with a public name)? */
  canJoinHere: boolean;
  /** Given for a signed-out guest: Join calls this (to ask them to sign in) instead of joining. */
  onGuestJoin?: (game: OpenGameRow) => void;
  /** Given for a signed-in player: the empty list offers a Set Up Draft button (it goes to the draft setup pages). */
  onSetUpClick?: () => void;
}

/**
 * Open Drafts: every public draft that is waiting for players (Quick Play lobbies and hosted drafts alike),
 * as the same cards the homepage shows, with speed and format filters and a refresh button.
 */
export function OpenDraftsBrowser({ games, reload, canJoinHere, onGuestJoin, onSetUpClick }: OpenDraftsBrowserProps) {
  const [speed, setSpeed] = useState<'all' | TableSpeed>('all');
  const [format, setFormat] = useState<'all' | 'year' | 'people' | 'spec-draft'>('all');

  const filtered = speed !== 'all' || format !== 'all';
  const shown = games && games.filter((g) => (speed === 'all' || g.speed === speed) && (format === 'all' || g.theme === format));

  let empty: { title: string; text: string } | undefined;
  if (filtered) empty = { title: 'No drafts match those filters', text: 'Try a different speed or format.' };
  else if (onSetUpClick) empty = { title: 'No open drafts right now', text: 'Be the first: set up a draft and open it to the public.' };

  return (
    <section aria-labelledby="open-drafts-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="open-drafts-heading" className="m-0 font-brockmann text-xl font-medium leading-7 text-white">Open Drafts</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="filter-speed">Speed</label>
          <DropdownSelect
            id="filter-speed"
            className="w-auto min-w-[200px]"
            value={speed}
            onChange={(v) => setSpeed(v as typeof speed)}
            options={[
              { value: 'all', label: 'Any speed' },
              { value: 'live', label: 'Live (2 min or less per pick)' },
              { value: 'slow', label: 'Slow (hours per pick)' },
            ]}
          />
          <label className="sr-only" htmlFor="filter-format">Format</label>
          <DropdownSelect
            id="filter-format"
            className="w-auto min-w-[190px]"
            value={format}
            onChange={(v) => setFormat(v as typeof format)}
            options={[
              { value: 'all', label: 'Any format' },
              { value: 'year', label: 'Draft by Year' },
              { value: 'people', label: 'Draft by Filmography' },
              { value: 'spec-draft', label: 'Special Draft' },
            ]}
          />
          <Button
            variant="outline"
            onClick={() => void reload()}
            aria-label="Refresh drafts"
            className="h-10 w-10 rounded-[2px] border-[#49474B] bg-transparent p-0 text-white hover:bg-[#1D1D1F] hover:text-white"
          >
            <RefreshCw size={16} aria-hidden />
          </Button>
        </div>
      </div>

      <OpenGamesList
        games={shown}
        canJoinHere={canJoinHere}
        onGuestJoin={onGuestJoin}
        empty={empty}
        gridClassName="gap-[18px]"
        emptyAction={
          onSetUpClick && !filtered ? (
            <Button
              onClick={onSetUpClick}
              className="h-12 shrink-0 rounded-[2px] bg-[#7142FF] px-8 font-brockmann text-base font-semibold tracking-[0.32px] text-[#FCFFFF] hover:bg-[#5e32e0]"
            >
              Set Up Draft
            </Button>
          ) : undefined
        }
      />
    </section>
  );
}
