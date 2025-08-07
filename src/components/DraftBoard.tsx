import React from 'react';
import { DraftActorPortrait } from './DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

interface Player {
  id: number;
  name: string;
}

interface DraftBoardProps {
  players: Player[];
  categories: string[];
  picks: Pick[];
  theme: string;
  draftOption: string;
  currentPlayer?: {
    id: number;
    name: string;
  };
}

const DraftBoard = ({ players, categories, picks, theme, draftOption, currentPlayer }: DraftBoardProps) => {
  // Debug logging
  console.log('DraftBoard - Current player:', currentPlayer);
  console.log('DraftBoard - Players:', players);

  // Extract actor name for people theme using standardized function
  const actorName = theme === 'people' ? getCleanActorName(draftOption) : '';

  return (
    <div className="w-full p-6 bg-ui-primary rounded shadow-[0px_0px_3px_rgba(0,0,0,0.25)] mb-6">
      <div className="flex flex-col justify-center items-center gap-2 mb-6">
        <span className="text-text-primary text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
          DRAFT BOARD
        </span>
      </div>
      
      <div className="overflow-hidden flex flex-col">
        {/* Header Row */}
        <div className="flex justify-start items-start border-b border-purple-700">
          <div className="w-[120px] py-[14px] px-4 flex flex-col justify-start items-start">
            <span className="text-purple-700 text-sm font-brockmann font-medium leading-5">Player</span>
          </div>
          {categories.map((category, index) => (
            <div key={category} className="min-w-[150px] py-[14px] px-4 flex flex-col justify-start items-center">
              <span className="text-purple-700 text-sm font-brockmann font-medium leading-5 text-center">{category.replace(/\s*\([^)]*\)/g, "")}</span>
            </div>
          ))}
        </div>

        {/* Body Rows */}
        <div className="flex flex-col">
          {players.map((player) => {
            const isCurrentPlayer = currentPlayer && currentPlayer.id === player.id;
            console.log(`Player ${player.name} (ID: ${player.id}) - Is current: ${isCurrentPlayer}`);
            
            return (
              <div 
                key={player.id}
                className={`flex justify-start items-center py-3 ${
                  isCurrentPlayer ? 'bg-purple-100' : ''
                }`}
              >
                <div className="w-auto py-[14px] px-4 flex flex-col justify-start items-start">
                  <span 
                    className={`text-sm font-brockmann font-medium leading-5 ${
                      isCurrentPlayer ? 'text-purple-500' : 'text-greyscale-blue-600'
                    }`}
                  >
                    {player.name}
                  </span>
                </div>
                
                {categories.map((category) => {
                  const pick = picks.find(p => p.playerId === player.id && p.category === category);
                  return (
                    <div key={category} className="w-[140px] min-w-[150px] flex flex-col justify-start items-center">
                      {pick ? (
                        <div className="flex flex-col items-center">
                          <span className="text-text-primary text-sm font-brockmann font-semibold leading-5 tracking-[0.24px] text-center">
                            {pick.movie.title}
                          </span>
                        </div>
                      ) : (
                        <span className="text-greyscale-blue-600 text-sm font-brockmann font-normal leading-5">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DraftBoard;
