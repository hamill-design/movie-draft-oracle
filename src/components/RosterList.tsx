import React from 'react';
import { DraftPick } from '@/hooks/useDrafts';

interface RosterListProps {
  playerName: string;
  picks: DraftPick[];
}

/** Roster-only list: player name + movie titles (no scores). Used on the public vote page. */
const RosterList: React.FC<RosterListProps> = ({ playerName, picks }) => {
  const sorted = [...picks].sort((a, b) => a.pick_order - b.pick_order);
  return (
    <div className="rounded-[8px] flex flex-col gap-3 p-4 bg-greyscale-purp-850 border border-greyscale-purp-700">
      <div className="text-greyscale-blue-100 font-brockmann font-semibold text-base">{playerName}</div>
      <ul className="flex flex-col gap-1.5 list-none pl-0">
        {sorted.map((pick) => (
          <li key={pick.id} className="flex items-center gap-2 text-greyscale-blue-200 text-sm font-brockmann">
            {pick.movie_id && (pick as any).poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${(pick as any).poster_path}`}
                alt=""
                className="w-10 h-[60px] object-cover rounded shrink-0"
              />
            ) : null}
            <span>
              {pick.movie_title}
              {pick.movie_year ? ` (${pick.movie_year})` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RosterList;
