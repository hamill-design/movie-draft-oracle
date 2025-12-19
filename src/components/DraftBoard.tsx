
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

  // Category display mapping - you can customize the display names here
  const categoryDisplayNames: { [key: string]: string } = {
    'Academy Award Nominee or Winner': 'Academy Award',
    'Blockbuster (minimum of $50 Mil)': 'Blockbuster',
    // Add more mappings as needed
  };

  // Function to get display name for category
  const getCategoryDisplayName = (category: string) => {
    return categoryDisplayNames[category] || category;
  };

  return (
    <div 
      className="w-full rounded-lg flex flex-col gap-6"
      style={{
        padding: '24px',
        background: '#0E0E0F',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px'
      }}
    >
      <div className="flex flex-col justify-center items-center gap-2">
        <div 
          className="text-center"
          style={{
            color: '#FCFFFF',
            fontSize: '24px',
            fontFamily: 'Brockmann',
            fontWeight: 700,
            lineHeight: '32px',
            letterSpacing: '0.96px'
          }}
        >
          DRAFT BOARD
        </div>
      </div>
      
      <div className="w-full overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div 
            style={{
              minWidth: `${120.59 + (categories.length * 150)}px`,
              width: '100%'
            }}
          >
            {/* Header Row */}
            <div 
              className="flex"
              style={{ 
                borderBottom: '1px #907AFF solid',
                width: '100%'
              }}
            >
              <div 
                className="flex flex-col justify-center items-start"
                style={{
                  flex: '0 0 120.59px',
                  minWidth: '120.59px',
                  paddingTop: '13.50px',
                  paddingBottom: '14.50px',
                  paddingLeft: '16px',
                  paddingRight: '16px'
                }}
              >
                <div 
                  style={{
                    color: '#907AFF',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 500,
                    lineHeight: '20px'
                  }}
                >
                  Player
                </div>
              </div>
              {categories.map((category) => {
                const categoryName = getCategoryDisplayName(category);
                
                return (
                  <div 
                    key={category} 
                    className="flex flex-col justify-center items-center"
                    style={{
                      flex: '1 1 0',
                      minWidth: '150px',
                      paddingTop: '13.50px',
                      paddingBottom: '14.50px',
                      paddingLeft: '16px',
                      paddingRight: '16px'
                    }}
                  >
                    <div 
                      className="text-center"
                      style={{
                        color: '#907AFF',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: 500,
                        lineHeight: '20px'
                      }}
                    >
                      {categoryName}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body Rows */}
            <div className="flex flex-col">
              {players.map((player) => {
                const isCurrentPlayer = currentPlayer && currentPlayer.id === player.id;
                
                return (
                  <div 
                    key={player.id}
                    className="flex"
                    style={{ 
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      background: isCurrentPlayer ? 'var(--Purple-800, #25015E)' : 'transparent',
                      width: '100%'
                    }}
                  >
                    <div 
                      className="flex flex-col justify-center items-start"
                      style={{
                        flex: '0 0 120.59px',
                        minWidth: '120.59px',
                        paddingTop: '13.50px',
                        paddingBottom: '14.50px',
                        paddingLeft: '16px',
                        paddingRight: '16px'
                      }}
                    >
                      <div 
                        style={{
                          color: '#FCFFFF',
                          fontSize: '14px',
                          fontFamily: 'Brockmann',
                          fontWeight: 500,
                          lineHeight: '20px'
                        }}
                      >
                        {player.name}
                      </div>
                    </div>
                    
                    {categories.map((category) => {
                      const pick = picks.find(p => p.playerId === player.id && p.category === category);
                      
                      return (
                        <div 
                          key={category} 
                          className="flex flex-col justify-center items-center"
                          style={{
                            flex: '1 1 0',
                            minWidth: '150px',
                            paddingTop: '13.50px',
                            paddingBottom: '14.50px',
                            paddingLeft: '16px',
                            paddingRight: '16px'
                          }}
                        >
                          {pick ? (
                            <div className="w-full overflow-hidden flex flex-col justify-start items-center">
                              <div 
                                className="w-full text-center"
                                style={{
                                  color: '#FCFFFF',
                                  fontSize: '14px',
                                  fontFamily: 'Brockmann',
                                  fontWeight: 500,
                                  lineHeight: '20px'
                                }}
                              >
                                {pick.movie.title}
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-center"
                              style={{
                                color: '#FCFFFF',
                                fontSize: '14px',
                                fontFamily: 'Brockmann',
                                fontWeight: 400,
                                lineHeight: '20px'
                              }}
                            >
                              -
                            </div>
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
      </div>
    </div>
  );
};

export default DraftBoard;
