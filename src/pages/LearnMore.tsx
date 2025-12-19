
import React from 'react';

const LearnMore = () => {
  return (
    <div style={{
      width: '100%',
      paddingBottom: '64px',
      background: 'var(--Section-Container, #0E0E0F)',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '64px',
      display: 'flex'
    }}>
        {/* Hero Section */}
        <section style={{
          width: '100%',
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingTop: '80px',
          paddingBottom: '80px',
          background: 'linear-gradient(140deg, var(--Purple-900, #100029) 16%, var(--Purple-850, #160038) 50%, var(--Purple-900, #100029) 83%)',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1400px',
            paddingLeft: '24px',
            paddingRight: '24px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: '24px',
            display: 'flex'
          }}>
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <span style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '64px',
                  fontFamily: 'CHANEY',
                  fontWeight: '400',
                  lineHeight: '76px',
                  wordWrap: 'break-word'
                }}>This isn't TRivia.      </span>
                <span style={{
                  color: 'var(--Yellow-500, #FFD60A)',
                  fontSize: '64px',
                  fontFamily: 'CHANEY',
                  fontWeight: '400',
                  lineHeight: '76px',
                  wordWrap: 'break-word'
                }}>It's Taste.</span>
              </div>
            </div>
            <div style={{
              width: '768px',
              maxWidth: '768px',
              paddingTop: '8px',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}>
              <div style={{
                width: '724px',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '18px',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                lineHeight: '26px',
                wordWrap: 'break-word'
              }}>
                Movie Draft challenges you to curate the perfect collection of films. Strategy meets cinema in this competitive drafting experience.
              </div>
            </div>
          </div>
        </section>

        {/* How to Play Section */}
        <section style={{
          width: '100%',
          maxWidth: '880px',
          paddingLeft: '24px',
          paddingRight: '24px',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '48px',
          display: 'flex'
        }}>
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex'
          }}>
            <div style={{
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'var(--Brand-Primary, #7142FF)',
              fontSize: '29.53px',
              fontFamily: 'Brockmann',
              fontWeight: '700',
              lineHeight: '36px',
              wordWrap: 'break-word'
            }}>
              How to Play
            </div>
          </div>
          
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '32px',
            display: 'flex'
          }}>
            {/* What is Movie Draft */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '16px',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.59px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word'
                  }}>
                    What is a Movie Draft?
                  </div>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Movie Draft is a competitive game where players take turns selecting movies based on a chosen theme. The goal is to build the highest-scoring collection of films!
                  </div>
                </div>
              </div>
            </div>

            {/* How to Set Up */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '16px',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.44px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word'
                  }}>
                    How to Set Up
                  </div>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '8px',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      flex: '1 1 0',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      lineHeight: '20px',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-line'
                    }}>
                      Choose a draft theme (by Person or by Year){'\n'}Select your specific option (actor/director or year){'\n'}Add all players who will participate{'\n'}Choose your scoring categories and draft style
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Draft */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '16px',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '17.97px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word'
                  }}>
                    How to Draft
                  </div>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '8px',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      flex: '1 1 0',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      lineHeight: '20px',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-line'
                    }}>
                      Players take turns in order selecting movies{'\n'}Search and pick movies that match your theme{'\n'}Each player builds their roster of films{'\n'}Continue until everyone has selected their movies
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scoring */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '16px',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.13px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word'
                  }}>
                    Scoring
                  </div>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Movies are scored based on the categories you selected (IMDb rating, box office, critics scores, etc.). The player with the highest total score wins!
                  </div>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Brand-Primary, #7142FF)',
                  fontSize: '18.75px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '28px',
                  wordWrap: 'break-word'
                }}>
                  Pro Tips
                </div>
              </div>
              <div style={{
                alignSelf: 'stretch',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '15px',
                display: 'inline-flex'
              }}>
                <div style={{
                  flex: '1 1 0',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-line'
                }}>
                  Balance popular hits with hidden gems{'\n'}Pay attention to what others are selecting{'\n'}Have fun and discover new movies!
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
};

export default LearnMore;
