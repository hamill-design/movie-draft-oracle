import React from 'react';
import { DraftPick } from '@/hooks/useDrafts';
import MovieScoreCard from './MovieScoreCard';

interface CategoryComparisonProps {
  categoryName: string;
  picks: DraftPick[];
}

const CategoryComparison: React.FC<CategoryComparisonProps> = ({ categoryName, picks }) => {
  // Group picks by player
  const playerGroups = picks.reduce((acc, pick) => {
    if (!acc[pick.player_name]) {
      acc[pick.player_name] = [];
    }
    acc[pick.player_name].push(pick);
    return acc;
  }, {} as Record<string, DraftPick[]>);

  // Sort players by their pick's score in this category
  const sortedPlayers = Object.entries(playerGroups).sort((a, b) => {
    const aScore = (a[1][0] as any).calculated_score || 0;
    const bScore = (b[1][0] as any).calculated_score || 0;
    return bScore - aScore;
  });

  return (
    <div style={{
      width: '100%',
      padding: '24px',
      background: 'hsl(var(--greyscale-blue-100))',
      boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)',
      borderRadius: '4px',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: '24px',
      display: 'flex'
    }}>
      <div style={{
        alignSelf: 'stretch',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        display: 'flex'
      }}>
        <div style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--Text-Primary, #2B2D2D)',
          fontSize: '24px',
          fontFamily: 'Brockmann',
          fontWeight: '700',
          lineHeight: '32px',
          letterSpacing: '0.96px',
          wordWrap: 'break-word'
        }}>
          {categoryName.toUpperCase()}
        </div>
      </div>

      <div style={{
        alignSelf: 'stretch',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: '24px',
        display: 'flex'
      }}>
        {sortedPlayers.map(([playerName, playerPicks], index) => {
          const pick = playerPicks[0];
          const pickWithScoring = pick as any;
          
          return (
            <div key={playerName} style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '12px',
              display: 'flex'
            }}>
              <div style={{
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '12px',
                display: 'flex'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: index === 0 ? 'var(--Yellow-500, #FFD60A)' : 
                             index === 1 ? 'var(--Greyscale-300, #CCCCCC)' : 
                             index === 2 ? '#DE7E3E' :
                             'var(--Greyscale-800, #4D4D4D)',
                  borderRadius: '9999px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  display: 'flex'
                }}>
                  <div style={{
                    textAlign: 'center',
                    color: index === 2 ? 'var(--Greyscale-(Blue)-50, #F8F8F8)' : 
                           index >= 3 ? 'var(--UI-Primary, white)' :
                           'var(--Greyscale-(Blue)-800, #2B2D2D)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '700',
                    lineHeight: '16px'
                  }}>
                    {index + 1}
                  </div>
                </div>
                <div style={{
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  paddingTop: '4px',
                  paddingBottom: '4px',
                  background: 'var(--Purple-150, #D3CFFF)',
                  borderRadius: '4px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  display: 'flex'
                }}>
                  <div style={{
                    color: 'var(--Purple-700, #3B0394)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '600',
                    lineHeight: '20px'
                  }}>
                    {playerName}
                  </div>
                </div>
              </div>
              
              <MovieScoreCard
                movieTitle={pick.movie_title}
                movieYear={pick.movie_year}
                movieGenre={pick.movie_genre}
                posterUrl={pick.movie_id ? `https://image.tmdb.org/t/p/w200${pickWithScoring.poster_path || ''}` : null}
                pickNumber={pick.pick_order}
                category={pick.category}
                scoringData={{
                  budget: pickWithScoring.movie_budget,
                  revenue: pickWithScoring.movie_revenue,
                  rtCriticsScore: pickWithScoring.rt_critics_score,
                  rtAudienceScore: pickWithScoring.rt_audience_score,
                  metacriticScore: pickWithScoring.metacritic_score,
                  imdbRating: pickWithScoring.imdb_rating,
                  oscarStatus: pickWithScoring.oscar_status
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryComparison;
