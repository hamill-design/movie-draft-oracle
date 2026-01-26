
import React from 'react';
import { calculateDetailedScore, getScoreColor, getScoreGrade, MovieScoringData } from '@/utils/scoreCalculator';
import { DollarIcon } from '@/components/icons/DollarIcon';
import { RibbonIcon } from '@/components/icons/RibbonIcon';
import { StarIcon } from '@/components/icons/StarIcon';
import { FilmReelIcon } from '@/components/icons/FilmReelIcon';
import { TrophyIcon } from '@/components/icons/TrophyIcon';
import { OscarStatusChip } from '@/components/OscarStatusChip';

interface MovieScoreCardProps {
  movieTitle: string;
  movieYear?: number | null;
  movieGenre?: string | null;
  scoringData: MovieScoringData;
  posterUrl?: string | null;
  pickNumber?: number;
  category?: string;
  className?: string;
  calculatedScore?: number | null; // Use stored calculated_score if available
}

const MovieScoreCard: React.FC<MovieScoreCardProps> = ({
  movieTitle,
  movieYear,
  movieGenre,
  scoringData,
  posterUrl,
  pickNumber,
  category,
  className = '',
  calculatedScore
}) => {
  const scoreBreakdown = calculateDetailedScore(scoringData);
  
  // Always use recalculated score to ensure it matches current calculation logic
  // The database calculated_score may be stale if calculation logic changed
  const displayScore = scoreBreakdown.finalScore;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        background: 'var(--Section-Container, #0E0E0F)',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '24px',
        display: 'inline-flex'
      }}
      className={className}
    >
      {/* Movie Header Section */}
      <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
        <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
          <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'inline-flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
            <div style={{ flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex' }}>
              {/* Movie Poster */}
              {posterUrl && (
                <div style={{ width: '80px', height: '119px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                  <img 
                    style={{ 
                      width: '80px', 
                      flex: '1 1 0', 
                      maxWidth: '100px', 
                      maxHeight: '148.75px', 
                      position: 'relative', 
                      borderRadius: '2px', 
                      border: '0.50px var(--Purple-200, #BCB2FF) solid' 
                    }} 
                    src={posterUrl.startsWith('/') ? `https://image.tmdb.org/t/p/w185${posterUrl}` : posterUrl}
                    alt={`${movieTitle} poster`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Movie Info and Score */}
              <div style={{ flex: '1 1 0', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
                <div style={{ flex: '1 1 0', minWidth: '202px', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '12px', display: 'inline-flex' }}>
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '4px', display: 'flex' }}>
                    <div style={{ 
                      alignSelf: 'stretch', 
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '24px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: 600, 
                      lineHeight: '30px', 
                      letterSpacing: '0.48px', 
                      wordWrap: 'break-word' 
                    }}>
                      {movieTitle}
                    </div>
                    <div style={{ 
                      alignSelf: 'stretch', 
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '14px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: 400, 
                      lineHeight: '20px', 
                      wordWrap: 'break-word' 
                    }}>
                      {movieYear && movieGenre ? `${movieYear} • ${movieGenre}` : movieYear || movieGenre}
                    </div>
                  </div>
                </div>
                <div style={{ flex: '1 1 0', minWidth: '86px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'inline-flex' }}>
                  <div style={{ 
                    textAlign: 'right', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Purple, #907AFF)', 
                    fontSize: '32px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: 700, 
                    lineHeight: '36px', 
                    letterSpacing: '1.28px',
                    wordWrap: 'break-word' 
                  }}>
                    {displayScore.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pick Badge and Score Breakdown */}
      <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '16px', display: 'flex' }}>
        {/* Pick Number and Category */}
        {pickNumber && category && (
          <div style={{ width: '100%', height: '100%', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', display: 'inline-flex' }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              paddingTop: '5px', 
              paddingBottom: '5px', 
              paddingLeft: '7.50px', 
              paddingRight: '9px', 
              background: 'var(--Brand-Primary, #7142FF)', 
              borderRadius: '99999px', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              display: 'inline-flex' 
            }}>
              <div style={{ 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '18px', 
                fontFamily: 'Brockmann', 
                fontWeight: 400, 
                lineHeight: '18px', 
                wordWrap: 'break-word' 
              }}>
                {pickNumber}
              </div>
            </div>
            <div style={{ 
              paddingLeft: '8px', 
              paddingRight: '8px', 
              paddingTop: '4px', 
              paddingBottom: '4px', 
              background: 'var(--UI-Primary-Pressed, #25015E)', 
              borderRadius: '4px', 
              outline: '1px solid #907AFF', 
              outlineOffset: '-1px',
              flexDirection: 'column', 
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              display: 'inline-flex' 
            }}>
              <div style={{ 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '12px', 
                fontFamily: 'Brockmann', 
                fontWeight: 400, 
                lineHeight: '16px', 
                wordWrap: 'break-word' 
              }}>
                {category}
              </div>
            </div>
          </div>
        )}

        {/* Score Breakdown Section */}
        <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex' }}>
          <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
              <div style={{ 
                alignSelf: 'stretch', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '16px', 
                fontFamily: 'Brockmann', 
                fontWeight: 600, 
                lineHeight: '24px', 
                letterSpacing: '0.32px', 
                wordWrap: 'break-word' 
              }}>
                Score Breakdown
              </div>
            </div>

            {/* Score Metrics */}
            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex' }}>
              
              {/* Box Office Score */}
              {scoreBreakdown.availableComponents.includes('Box Office') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                    <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                       <DollarIcon style={{ width: '16px', height: '16px', color: 'var(--Text-Light-grey, #BDC3C2)' }} />
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          Box Office Score
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {((scoringData.revenue && scoringData.budget) ? ((scoringData.revenue - scoringData.budget) / scoringData.revenue * 100).toFixed(2) : 0)}%
                      </div>
                    </div>
                  </div>
                   <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: '#2C2B2D', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(scoreBreakdown.boxOfficeScore, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Brand-Primary, #7142FF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* RT Critics */}
              {scoreBreakdown.availableComponents.includes('RT Critics') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                       <RibbonIcon style={{ width: '16px', height: '16px', color: 'var(--Text-Light-grey, #BDC3C2)' }} />
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          RT Critics
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {scoringData.rtCriticsScore || 0}%
                      </div>
                    </div>
                  </div>
                   <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: '#2C2B2D', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.rtCriticsScore || 0) / 100) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Brand-Primary, #7142FF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* Metacritic */}
              {scoreBreakdown.availableComponents.includes('Metacritic') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                       <StarIcon style={{ width: '16px', height: '16px', color: 'var(--Text-Light-grey, #BDC3C2)' }} />
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          Metacritic
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {scoringData.metacriticScore || 0}/100
                      </div>
                    </div>
                  </div>
                   <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: '#2C2B2D', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.metacriticScore || 0) / 100) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Brand-Primary, #7142FF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* IMDB */}
              {scoreBreakdown.availableComponents.includes('IMDB') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                       <FilmReelIcon style={{ width: '16px', height: '16px', color: 'var(--Text-Light-grey, #BDC3C2)' }} />
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          IMDB 
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {Math.round((scoringData.imdbRating || 0) * 10)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: '#2C2B2D', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.imdbRating || 0) / 10) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Brand-Primary, #7142FF)' 
                    }}></div>
                  </div>
                </div>
              )}


              {/* Oscar Status */}
              <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                   <TrophyIcon style={{ width: '16px', height: '16px', color: 'var(--Yellow-500, #FFD60A)' }} />
                  <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                      Oscar Status 
                    </div>
                  </div>
                </div>
                <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '7.99px', display: 'flex' }}>
                  <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                      +{scoreBreakdown.oscarBonus} pts
                    </div>
                  </div>
                  <OscarStatusChip status={scoringData.oscarStatus} />
                </div>
              </div>
            </div>
          </div>

          {/* Box Office Data */}
          {(scoringData.budget || scoringData.revenue) && (
            <div style={{ alignSelf: 'stretch', paddingTop: '12px', borderTop: '1px var(--Item-Stroke, #49474B) solid', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ 
                  alignSelf: 'stretch', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #FCFFFF)', 
                  fontSize: '16px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: 600, 
                  lineHeight: '24px', 
                  letterSpacing: '0.32px', 
                  wordWrap: 'break-word' 
                }}>
                  Box Office Data
                </div>
              </div>
              <div style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', gap: '8px', display: 'inline-flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
                {scoringData.budget && (
                  <div style={{ flex: '1 1 0', height: '20px', minWidth: '160px', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px', wordWrap: 'break-word' }}>
                      Budget:
                    </div>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px', wordWrap: 'break-word' }}>
                      {formatCurrency(scoringData.budget)}
                    </div>
                  </div>
                )}
                {scoringData.revenue && (
                  <div style={{ flex: '1 1 0', height: '20px', minWidth: '145px', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px', wordWrap: 'break-word' }}>
                      Revenue:
                    </div>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px', wordWrap: 'break-word' }}>
                      {formatCurrency(scoringData.revenue)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieScoreCard;
