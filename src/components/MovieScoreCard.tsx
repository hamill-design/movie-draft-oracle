
import React from 'react';
import { calculateDetailedScore, getScoreColor, getScoreGrade, MovieScoringData } from '@/utils/scoreCalculator';

interface MovieScoreCardProps {
  movieTitle: string;
  movieYear?: number | null;
  movieGenre?: string | null;
  scoringData: MovieScoringData;
  posterUrl?: string | null;
  pickNumber?: number;
  category?: string;
  className?: string;
}

const MovieScoreCard: React.FC<MovieScoreCardProps> = ({
  movieTitle,
  movieYear,
  movieGenre,
  scoringData,
  posterUrl,
  pickNumber,
  category,
  className = ''
}) => {
  const scoreBreakdown = calculateDetailedScore(scoringData);

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
        background: 'hsl(var(--greyscale-blue-100))',
        boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)',
        borderRadius: '4px',
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
                      color: 'var(--Text-Primary, #2B2D2D)', 
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
                      color: 'var(--Text-Primary, #2B2D2D)', 
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
                    color: 'var(--Brand-Primary, #680AFF)', 
                    fontSize: '32px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: 500, 
                    lineHeight: '28px', 
                    wordWrap: 'break-word' 
                  }}>
                    {scoreBreakdown.finalScore}
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
          <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: '6px', display: 'inline-flex' }}>
            <div style={{ width: '28px', height: '28px' }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '99999px', 
                outline: '1px var(--Brand-Primary, #680AFF) solid', 
                outlineOffset: '-1px', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                display: 'inline-flex' 
              }}>
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--Brand-Primary, #680AFF)', 
                  fontSize: '14px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: 400, 
                  lineHeight: '16px', 
                  wordWrap: 'break-word' 
                }}>
                  {pickNumber}
                </div>
              </div>
            </div>
            <div style={{ 
              paddingLeft: '8px', 
              paddingRight: '8px', 
              paddingTop: '4px', 
              paddingBottom: '4px', 
              background: 'var(--Purple-150, #D3CFFF)', 
              borderRadius: '4px', 
              flexDirection: 'column', 
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              display: 'inline-flex' 
            }}>
              <div style={{ 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Purple-700, #3B0394)', 
                fontSize: '14px', 
                fontFamily: 'Brockmann', 
                fontWeight: 500, 
                lineHeight: '20px', 
                wordWrap: 'break-word' 
              }}>
                {category}
              </div>
            </div>
          </div>
        )}

        {/* Score Breakdown Section */}
        <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '16px', display: 'flex' }}>
          <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
              <div style={{ 
                alignSelf: 'stretch', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #2B2D2D)', 
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
            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '7px', display: 'flex' }}>
              
              {/* Box Office Profit */}
              {scoreBreakdown.availableComponents.includes('Box Office') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                      <div style={{ width: '16px', height: '16px', paddingLeft: '2px', paddingRight: '2px', paddingTop: '1px', paddingBottom: '1px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex' }}>
                        <div style={{ width: '8.91px', flex: '1 1 0', background: 'var(--Greyscale-(Blue)-500, #828786)' }}></div>
                      </div>
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          Box Office Profit
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {((scoringData.revenue && scoringData.budget) ? ((scoringData.revenue - scoringData.budget) / scoringData.budget * 100).toFixed(2) : 0)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: 'var(--Greyscale-(Blue)-200, #D9E0DF)', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoreBreakdown.boxOfficeScore / 200) * 100), 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Purple-500, #680AFF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* RT Critics */}
              {scoreBreakdown.availableComponents.includes('RT Critics') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                      <div style={{ width: '16px', height: '16px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex' }}>
                        <div style={{ width: '8.40px', flex: '1 1 0', background: 'var(--Greyscale-(Blue)-500, #828786)' }}></div>
                      </div>
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          RT Critics
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {scoringData.rtCriticsScore || 0}%
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: 'var(--Greyscale-(Blue)-200, #D9E0DF)', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.rtCriticsScore || 0) / 100) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Purple-500, #680AFF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* Metacritic */}
              {scoreBreakdown.availableComponents.includes('Metacritic') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                      <div style={{ width: '16px', height: '16px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex' }}>
                        <div style={{ width: '12px', flex: '1 1 0', background: 'var(--Greyscale-(Blue)-500, #828786)' }}></div>
                      </div>
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          Metacritic
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {scoringData.metacriticScore || 0}/100
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: 'var(--Greyscale-(Blue)-200, #D9E0DF)', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.metacriticScore || 0) / 100) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Purple-500, #680AFF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* IMDB */}
              {scoreBreakdown.availableComponents.includes('IMDB') && (
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                      <div style={{ width: '16px', height: '16px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex' }}>
                        <div style={{ alignSelf: 'stretch', height: '12px', background: 'var(--Greyscale-(Blue)-500, #828786)' }}></div>
                      </div>
                      <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                          IMDB 
                        </div>
                      </div>
                    </div>
                    <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                      <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                        {Math.round((scoringData.imdbRating || 0) * 10)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'stretch', height: '8px', position: 'relative', background: 'var(--Greyscale-(Blue)-200, #D9E0DF)', overflow: 'hidden', borderRadius: '9999px' }}>
                    <div style={{ 
                      width: `${Math.min(((scoringData.imdbRating || 0) / 10) * 100, 100)}%`, 
                      height: '8px', 
                      position: 'absolute', 
                      background: 'var(--Purple-500, #680AFF)' 
                    }}></div>
                  </div>
                </div>
              )}

              {/* Oscar Status */}
              <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex' }}>
                  <div style={{ width: '16px', height: '16px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex' }}>
                    <div style={{ width: '12px', flex: '1 1 0', background: 'var(--Yellow-500, #FFD60A)' }}></div>
                  </div>
                  <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', wordWrap: 'break-word' }}>
                      Oscar Status 
                    </div>
                  </div>
                </div>
                <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: '7.99px', display: 'flex' }}>
                  <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '16px', wordWrap: 'break-word' }}>
                      +{scoreBreakdown.oscarBonus} pts
                    </div>
                  </div>
                  <div style={{ 
                    paddingLeft: '12px', 
                    paddingRight: '12px', 
                    paddingTop: '4px', 
                    paddingBottom: '4px', 
                    background: scoringData.oscarStatus === 'winner' ? 'var(--Yellow-500, #FFD60A)' : 'var(--Yellow-200, #FFF2B2)', 
                    borderRadius: '9999px', 
                    justifyContent: 'flex-start', 
                    alignItems: 'center', 
                    display: 'flex' 
                  }}>
                    <div style={{ 
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #2B2D2D)', 
                      fontSize: '12px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: 600, 
                      lineHeight: '16px', 
                      wordWrap: 'break-word' 
                    }}>
                      {scoringData.oscarStatus === 'winner' ? 'Winner' : 
                       scoringData.oscarStatus === 'nominee' ? 'Nominee' : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Box Office Data */}
          {(scoringData.budget || scoringData.revenue) && (
            <div style={{ alignSelf: 'stretch', paddingTop: '12px', borderTop: '1px var(--Greyscale-(Blue)-700, #474B4B) solid', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ 
                  alignSelf: 'stretch', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #2B2D2D)', 
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
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-600, #646968)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px', wordWrap: 'break-word' }}>
                      Budget:
                    </div>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px', wordWrap: 'break-word' }}>
                      {formatCurrency(scoringData.budget)}
                    </div>
                  </div>
                )}
                {scoringData.revenue && (
                  <div style={{ flex: '1 1 0', height: '20px', minWidth: '145px', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-600, #646968)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px', wordWrap: 'break-word' }}>
                      Revenue:
                    </div>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #2B2D2D)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px', wordWrap: 'break-word' }}>
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
