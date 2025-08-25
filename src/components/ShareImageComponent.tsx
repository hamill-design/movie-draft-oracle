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
      width: '1080px', 
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
          fontFamily: 'Chaney', 
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
              paddingTop: 28, 
              paddingBottom: 28,
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
                  width: 48, 
                  height: 48, 
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
                    fontSize: 24, 
                    fontFamily: 'Brockmann', 
                    fontWeight: '700', 
                    lineHeight: '32px', 
                    wordWrap: 'break-word'
                  }}>
                    {index + 1}
                  </div>
                </div>
                <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 2, display: 'inline-flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    justifyContent: 'flex-start', 
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
                       borderRadius: 4, 
                       border: '1px #E5E7EB solid'
                     }} src={data.firstPick.poster || "https://placehold.co/200x298"} alt={data.firstPick.title} />
                  </div>
                  <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 24, display: 'flex'}}>
                      <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex'}}>
                        <div style={{
                          justifyContent: 'flex-start', 
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
                          justifyContent: 'flex-start', 
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
                       borderRadius: 4, 
                       border: '1px #E5E7EB solid'
                     }} src={data.bestMovie.poster || "https://placehold.co/200x298"} alt={data.bestMovie.title} />
                  </div>
                  <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 24, display: 'flex'}}>
                      <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex'}}>
                        <div style={{
                          justifyContent: 'flex-start', 
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
                          justifyContent: 'flex-start', 
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
      <div style={{
        width: '100%', 
        height: 80, 
        background: '#680AFF', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        display: 'flex'
      }}>
        <svg width="300" height="18" viewBox="0 0 428 27" xmlns="http://www.w3.org/2000/svg">
          <g fill="white">
            <path d="M44.5008 0.690016V25.656C44.5008 26.0324 44.1876 26.3461 43.8118 26.3461H37.0787C36.7029 26.3461 36.3898 26.0324 36.3898 25.656V11.6048C36.3898 11.0403 35.7321 10.7266 35.2937 11.0716L22.7984 20.9828C22.5479 21.1709 22.2034 21.1709 21.9529 20.9828L9.17574 10.9775C8.73731 10.6325 8.07966 10.9775 8.07966 11.5107V25.656C8.07966 26.0324 7.76649 26.3461 7.3907 26.3461H0.688963C0.313165 26.3461 0 26.0324 0 25.656V0.690016C0 0.313644 0.313165 0 0.688963 0H7.86044C7.86044 0 8.14229 0.0627287 8.26756 0.125457L22.0155 10.6012C22.266 10.7893 22.6105 10.7893 22.8297 10.6012L36.2645 0.156822C36.2645 0.156822 36.5464 0 36.6716 0H43.8431C44.2189 0 44.5321 0.313644 44.5321 0.690016H44.5008Z"/>
            <path d="M85.5485 26.3461H48.689C48.3132 26.3461 48 26.0324 48 25.656V0.690016C48 0.313644 48.3132 0 48.689 0H85.5485C85.9243 0 86.2375 0.313644 86.2375 0.690016V25.656C86.2375 26.0324 85.9243 26.3461 85.5485 26.3461ZM77.9699 18.3795V7.87245C77.9699 7.49608 77.6567 7.18244 77.2809 7.18244H56.9565C56.5807 7.18244 56.2676 7.49608 56.2676 7.87245V18.3795C56.2676 18.7559 56.5807 19.0695 56.9565 19.0695H77.2809C77.6567 19.0695 77.9699 18.7559 77.9699 18.3795Z"/>
            <path d="M127.302 0.940931L116.247 25.907C116.153 26.1579 115.902 26.3147 115.621 26.3147H100.338V26.1265L89.1894 0.940931C89.0015 0.50183 89.3147 0 89.8158 0H97.1438C97.4257 0 97.6449 0.156822 97.7701 0.407737L105.599 18.6618C105.693 18.9127 105.944 19.0695 106.226 19.0695H110.203C110.485 19.0695 110.704 18.9127 110.829 18.6618L118.627 0.407737C118.721 0.156822 118.971 0 119.253 0H126.675C127.176 0 127.49 0.50183 127.302 0.940931Z"/>
            <path d="M152.01 7.93518V18.3795C152.01 18.7559 152.323 19.0695 152.699 19.0695H165.132C165.508 19.0695 165.821 19.3832 165.821 19.7595V25.656C165.821 26.0324 165.508 26.3461 165.132 26.3461H130.684C130.308 26.3461 129.995 26.0324 129.995 25.656V19.7595C129.995 19.3832 130.308 19.0695 130.684 19.0695H143.085C143.461 19.0695 143.774 18.7559 143.774 18.3795V7.93518C143.774 7.55881 143.461 7.24517 143.085 7.24517H130.684C130.308 7.24517 129.995 6.93152 129.995 6.55515V0.690016C129.995 0.313644 130.308 0 130.684 0H165.132C165.508 0 165.821 0.313644 165.821 0.690016V6.58651C165.821 6.96289 165.508 7.27653 165.132 7.27653H152.699C152.323 7.27653 152.01 7.59017 152.01 7.96655V7.93518Z"/>
            <path d="M177.815 7.15107V9.78568H202.743C203.119 9.78568 203.432 10.0993 203.432 10.4757V15.9645C203.432 16.3408 203.119 16.6545 202.743 16.6545H177.815V19.2263H205.311C205.687 19.2263 206 19.54 206 19.9164V25.7188C206 26.0951 205.687 26.4088 205.311 26.4088H170.237C169.861 26.4088 169.548 26.0951 169.548 25.7188V0.690016C169.548 0.313644 169.861 0 170.237 0H205.311C205.687 0 206 0.313644 206 0.690016V6.49242C206 6.86879 205.687 7.18244 205.311 7.18244H177.815V7.15107Z"/>
            <path d="M266.501 13.2357C266.501 21.3591 260.269 26.4088 252.033 26.4088H222.689C222.313 26.4088 222 26.0951 222 25.7188V0.75273C222 0.376358 222.313 0.0627136 222.689 0.0627136H252.064C260.3 0.0627136 266.532 5.08101 266.532 13.2357H266.501ZM258.108 13.2357C258.108 9.84839 255.54 7.27652 252.064 7.27652H230.894C230.518 7.27652 230.205 7.59016 230.205 7.96653V18.505C230.205 18.8813 230.518 19.195 230.894 19.195H252.033C255.54 19.1322 258.077 16.5917 258.077 13.2357H258.108Z"/>
            <path d="M315.448 0.564546C315.355 0.282267 315.104 0.0627136 314.791 0.0627136H300.824C300.51 0.0627136 300.26 0.282267 300.166 0.564546L293.809 24.6837L290.113 19.0695C289.926 18.7559 289.988 18.3795 290.301 18.1599C292.838 16.3095 294.279 13.4239 294.279 10.2248C294.279 4.61055 289.832 0.0627136 283.13 0.0627136H269.507C269.131 0.0627136 268.818 0.376358 268.818 0.75273V25.7188C268.818 26.0951 269.131 26.4088 269.507 26.4088H276.459C276.835 26.4088 277.148 26.0951 277.148 25.7188V21.0455C277.148 20.6691 277.462 20.3555 277.837 20.3555H281.47C281.721 20.3555 281.94 20.4809 282.065 20.7005L285.228 26.0638C285.353 26.2833 285.572 26.4088 285.823 26.4088H301.231C301.544 26.4088 301.794 26.1892 301.888 25.9069L302.703 22.7391C302.765 22.4255 303.047 22.2373 303.36 22.2373H312.348C312.661 22.2373 312.912 22.4569 313.006 22.7391L313.82 25.9069C313.883 26.2206 314.164 26.4088 314.478 26.4088H321.461C321.9 26.4088 322.244 26.001 322.119 25.5619L315.542 0.595908L315.448 0.564546ZM283.099 13.1103H277.775C277.399 13.1103 277.086 12.7966 277.086 12.4203V7.9979C277.086 7.62152 277.399 7.30788 277.775 7.30788H283.099C284.664 7.30788 285.98 8.59382 285.98 10.1934C285.98 11.793 284.664 13.0789 283.099 13.0789V13.1103ZM310.031 14.8981H305.552C305.114 14.8981 304.801 14.4903 304.895 14.0512L306.617 7.33925H308.935L310.657 14.0512C310.782 14.4903 310.438 14.8981 309.999 14.8981H310.031Z"/>
            <path d="M373.603 0.0627271H325.125C324.749 0.0627271 324.436 0.376372 324.436 0.752744V25.7188C324.436 26.0951 324.749 26.4088 325.125 26.4088H332.046C332.422 26.4088 332.735 26.0951 332.735 25.7188V18.6618C332.735 18.2854 333.048 17.9718 333.424 17.9718H350.961C351.337 17.9718 351.65 17.6581 351.65 17.2818V11.4794C351.65 11.103 351.337 10.7893 350.961 10.7893H332.767V7.27653H356.661C357.037 7.27653 357.35 7.59017 357.35 7.96654V25.6874C357.35 26.0638 357.663 26.3774 358.039 26.3774H364.96C365.336 26.3774 365.649 26.0638 365.649 25.6874V7.96654C365.649 7.59017 365.962 7.27653 366.338 7.27653H373.729C374.104 7.27653 374.417 6.96289 374.417 6.58651V0.690017C374.417 0.313644 374.104 0 373.729 0L373.603 0.0627271Z"/>
            <path d="M385.472 7.2138V9.8484H395.4C395.775 9.8484 396.089 10.162 396.089 10.5384V16.0272C396.089 16.4035 395.775 16.7172 395.4 16.7172H385.472V19.2263H397.936C398.312 19.2263 398.625 19.54 398.625 19.9164V25.7501C398.625 26.1265 398.312 26.4401 397.936 26.4401H377.894C377.518 26.4401 377.205 26.1265 377.205 25.7501V0.784102C377.205 0.40773 377.518 0.0940857 377.894 0.0940857H397.936C398.312 0.0940857 398.625 0.40773 398.625 0.784102V6.58651C398.625 6.96288 398.312 7.27652 397.936 7.27652H385.472V7.2138Z"/>
            <path d="M401.976 0.75273C401.976 0.376358 402.289 0.0627136 402.665 0.0627136H416.288C423.021 0.0627136 427.436 4.61055 427.436 10.2248C427.436 13.4239 425.996 16.3095 423.459 18.1599C423.177 18.3795 423.083 18.7559 423.271 19.0695L427.405 25.3424C427.687 25.7815 427.405 26.4088 426.841 26.4088H418.918C418.668 26.4088 418.448 26.2833 418.323 26.0638L415.16 20.7005C415.035 20.4809 414.816 20.3555 414.565 20.3555H410.933C410.557 20.3555 410.244 20.6691 410.244 21.0455V25.7188C410.244 26.0951 409.93 26.4088 409.555 26.4088H402.602C402.227 26.4088 401.913 26.0951 401.913 25.7188V0.75273H401.976ZM416.288 13.1103C417.853 13.1103 419.169 11.8243 419.169 10.2248C419.169 8.62518 417.853 7.33925 416.288 7.33925H410.964C410.588 7.33925 410.275 7.65289 410.275 8.02926V12.4516C410.275 12.828 410.588 13.1416 410.964 13.1416H416.288V13.1103Z"/>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ShareImageComponent;