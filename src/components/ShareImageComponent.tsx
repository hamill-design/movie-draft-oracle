import React from 'react';

interface TeamScore {
  playerName: string;
  totalScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface Movie {
  title: string;
  score: number;
  playerName: string;
  poster?: string;
  year?: number;
  genre?: string;
  category?: string;
  pickNumber?: number;
}

interface ShareImageData {
  title: string;
  teamScores: TeamScore[];
  totalMovies: number;
  bestMovie?: Movie;
  firstPick?: Movie;
}

interface ShareImageComponentProps {
  data: ShareImageData;
}

const ShareImageComponent: React.FC<ShareImageComponentProps> = ({ data }) => {
  const sortedTeamScores = data.teamScores.sort((a, b) => b.totalScore - a.totalScore);
  
  return (
    <div style={{
      width: '1046px', 
      height: '100%', 
      paddingLeft: 24, 
      paddingRight: 24, 
      paddingTop: 112, 
      paddingBottom: 112, 
      background: 'linear-gradient(140deg, #FCFFFF 0%, #F0F1FF 50%, #FCFFFF 100%)', 
      overflow: 'hidden', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      gap: 48, 
      display: 'inline-flex'
    }}>
      {/* Header */}
      <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column'}}>
        <span style={{
          color: '#2B2D2D', 
          fontSize: 64, 
          fontFamily: 'CHANEY', 
          fontWeight: '400', 
          lineHeight: '64px', 
          letterSpacing: 2.56, 
          wordWrap: 'break-word'
        }}>
          {data.title.split(' ').map((word, index) => (
            <span key={index} style={{color: index === 1 ? '#680AFF' : '#2B2D2D'}}>
              {index > 0 ? ' ' : ''}{word}
            </span>
          ))}
        </span>
      </div>

      {/* Top Scores Section */}
      <div style={{width: 998, padding: 24, borderRadius: 4, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'flex'}}>
        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex'}}>
          <div style={{
            justifyContent: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            color: '#2B2D2D', 
            fontSize: 48, 
            fontFamily: 'Brockmann', 
            fontWeight: '700', 
            lineHeight: '36px', 
            letterSpacing: 1.92, 
            wordWrap: 'break-word'
          }}>
            TOP SCORES
          </div>
        </div>
        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
          {sortedTeamScores.slice(0, 3).map((team, index) => (
            <div key={team.playerName} style={{
              alignSelf: 'stretch', 
              paddingLeft: 24, 
              paddingRight: 24, 
              paddingTop: 36, 
              paddingBottom: 36, 
              background: 'white', 
              borderRadius: 8, 
              outline: '1px #EDEBFF solid', 
              outlineOffset: '-1px', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              display: 'inline-flex'
            }}>
              <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 16, display: 'flex'}}>
                <div style={{
                  width: 32, 
                  height: 32, 
                  background: '#FFD60A', 
                  borderRadius: 9999, 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  display: 'flex'
                }}>
                  <div style={{
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: '#2B2D2D', 
                    fontSize: 16, 
                    fontFamily: 'Brockmann', 
                    fontWeight: '700', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>
                    {index + 1}
                  </div>
                </div>
                <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 2, display: 'inline-flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: '#2B2D2D', 
                    fontSize: 32, 
                    fontFamily: 'Brockmann', 
                    fontWeight: '500', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>
                    {team.playerName}
                  </div>
                </div>
              </div>
              <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'flex'}}>
                  <div style={{
                    textAlign: 'right', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: '#680AFF', 
                    fontSize: 48, 
                    fontFamily: 'Brockmann', 
                    fontWeight: '500', 
                    lineHeight: '32px', 
                    wordWrap: 'break-word'
                  }}>
                    {team.totalScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* First Pick Section */}
      {data.firstPick && (
        <div style={{width: 998, padding: 36, borderRadius: 4, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 36, display: 'flex'}}>
          <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex'}}>
            <div style={{
              justifyContent: 'center', 
              display: 'flex', 
              flexDirection: 'column', 
              color: '#2B2D2D', 
              fontSize: 48, 
              fontFamily: 'Brockmann', 
              fontWeight: '700', 
              lineHeight: '36px', 
              letterSpacing: 1.92, 
              wordWrap: 'break-word'
            }}>
              FIRST PICK
            </div>
          </div>
          <div style={{
            alignSelf: 'stretch', 
            padding: 24, 
            background: 'white', 
            borderRadius: 4, 
            outline: '1px #BCB2FF solid', 
            outlineOffset: '-1px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: 24, 
            display: 'flex'
          }}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'inline-flex'}}>
                  <div style={{width: 200, height: 298, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                    <img style={{
                      alignSelf: 'stretch', 
                      flex: '1 1 0', 
                      position: 'relative', 
                      borderRadius: 2, 
                      border: '0.50px #2B2D2D solid'
                    }} src={data.firstPick.poster || "https://placehold.co/200x298"} alt={data.firstPick.title} />
                  </div>
                  <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 24, display: 'flex'}}>
                      <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex'}}>
                        <div style={{
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#2B2D2D', 
                          fontSize: 36, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '600', 
                          lineHeight: '48px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.firstPick.title}
                        </div>
                        <div style={{
                          width: 561, 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#2B2D2D', 
                          fontSize: 24, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '40px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.firstPick.year && `${data.firstPick.year} • `}{data.firstPick.genre}
                        </div>
                      </div>
                      <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                        <div style={{
                          width: 52, 
                          height: 52, 
                          paddingTop: 9.29, 
                          paddingBottom: 9.29, 
                          paddingLeft: 13.93, 
                          paddingRight: 16.71, 
                          borderRadius: 185712.42, 
                          outline: '1.86px #680AFF solid', 
                          outlineOffset: '-1.86px', 
                          flexDirection: 'column', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            textAlign: 'center', 
                            color: '#680AFF', 
                            fontSize: 33.43, 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '33.43px', 
                            wordWrap: 'break-word'
                          }}>
                            {data.firstPick.pickNumber || '1'}
                          </div>
                        </div>
                        {data.firstPick.category && (
                          <div style={{
                            paddingLeft: 16, 
                            paddingRight: 16, 
                            paddingTop: 8, 
                            paddingBottom: 8, 
                            background: '#BCB2FF', 
                            borderRadius: 8, 
                            flexDirection: 'column', 
                            justifyContent: 'flex-start', 
                            alignItems: 'flex-start', 
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              justifyContent: 'center', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              color: '#3B0394', 
                              fontSize: 24, 
                              fontFamily: 'Brockmann', 
                              fontWeight: '500', 
                              lineHeight: '36px', 
                              wordWrap: 'break-word'
                            }}>
                              {data.firstPick.category}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'flex'}}>
                        <div style={{
                          textAlign: 'right', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#680AFF', 
                          fontSize: 48, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '500', 
                          lineHeight: '56px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.firstPick.score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Highest Scorer Section */}
      {data.bestMovie && (
        <div style={{width: 998, padding: 36, borderRadius: 4, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 36, display: 'flex'}}>
          <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex'}}>
            <div style={{
              justifyContent: 'center', 
              display: 'flex', 
              flexDirection: 'column', 
              color: '#2B2D2D', 
              fontSize: 48, 
              fontFamily: 'Brockmann', 
              fontWeight: '700', 
              lineHeight: '36px', 
              letterSpacing: 1.92, 
              wordWrap: 'break-word'
            }}>
              HIGHEST SCORER
            </div>
          </div>
          <div style={{
            alignSelf: 'stretch', 
            padding: 24, 
            background: 'white', 
            borderRadius: 4, 
            outline: '1px #BCB2FF solid', 
            outlineOffset: '-1px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: 24, 
            display: 'flex'
          }}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'inline-flex'}}>
                  <div style={{width: 200, height: 298, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                    <img style={{
                      alignSelf: 'stretch', 
                      flex: '1 1 0', 
                      position: 'relative', 
                      borderRadius: 2, 
                      border: '0.50px #2B2D2D solid'
                    }} src={data.bestMovie.poster || "https://placehold.co/200x298"} alt={data.bestMovie.title} />
                  </div>
                  <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 24, display: 'flex'}}>
                      <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex'}}>
                        <div style={{
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#2B2D2D', 
                          fontSize: 36, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '600', 
                          lineHeight: '48px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.bestMovie.title}
                        </div>
                        <div style={{
                          width: 561, 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#2B2D2D', 
                          fontSize: 24, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '40px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.bestMovie.year && `${data.bestMovie.year} • `}{data.bestMovie.genre}
                        </div>
                      </div>
                      <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                        <div style={{
                          width: 52, 
                          height: 52, 
                          paddingTop: 9.29, 
                          paddingBottom: 9.29, 
                          paddingLeft: 13.93, 
                          paddingRight: 16.71, 
                          borderRadius: 185712.42, 
                          outline: '1.86px #680AFF solid', 
                          outlineOffset: '-1.86px', 
                          flexDirection: 'column', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            textAlign: 'center', 
                            color: '#680AFF', 
                            fontSize: 33.43, 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '33.43px', 
                            wordWrap: 'break-word'
                          }}>
                            {data.bestMovie.pickNumber || '★'}
                          </div>
                        </div>
                        {data.bestMovie.category && (
                          <div style={{
                            paddingLeft: 16, 
                            paddingRight: 16, 
                            paddingTop: 8, 
                            paddingBottom: 8, 
                            background: '#BCB2FF', 
                            borderRadius: 8, 
                            flexDirection: 'column', 
                            justifyContent: 'flex-start', 
                            alignItems: 'flex-start', 
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              justifyContent: 'center', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              color: '#3B0394', 
                              fontSize: 24, 
                              fontFamily: 'Brockmann', 
                              fontWeight: '500', 
                              lineHeight: '36px', 
                              wordWrap: 'break-word'
                            }}>
                              {data.bestMovie.category}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'flex'}}>
                        <div style={{
                          textAlign: 'right', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: '#680AFF', 
                          fontSize: 48, 
                          fontFamily: 'Brockmann', 
                          fontWeight: '500', 
                          lineHeight: '56px', 
                          wordWrap: 'break-word'
                        }}>
                          {data.bestMovie.score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logo Footer */}
      <div style={{width: 728, justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'inline-flex'}}>
        <div style={{flex: '1 1 0', height: 45.02, background: '#680AFF'}} />
      </div>
    </div>
  );
};

export default ShareImageComponent;