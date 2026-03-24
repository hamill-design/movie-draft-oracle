
import React from 'react';
import { Helmet } from 'react-helmet-async';

const LearnMore = () => {
  return (
    <>
      <Helmet>
        <title>Movie Drafter - Learn More</title>
        <meta name="description" content="Learn how Movie Drafter works. Create fantasy movie drafts, compete with friends, and discover who has the best taste in cinema." />
        <link rel="canonical" href="https://moviedrafter.com/learn-more" />
        <meta property="og:title" content="Movie Drafter - Learn More" />
        <meta property="og:description" content="Learn how Movie Drafter works. Create fantasy movie drafts, compete with friends, and discover who has the best taste in cinema." />
        <meta property="og:url" content="https://moviedrafter.com/learn-more" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - Learn More" />
        <meta name="twitter:description" content="Learn how Movie Drafter works. Create fantasy movie drafts, compete with friends, and discover who has the best taste in cinema." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
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
              <h1 style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                margin: 0
              }}>
                <span className="text-4xl md:text-6xl lg:text-[64px] leading-[50px] md:leading-[60px] lg:leading-[76px]" style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontFamily: 'CHANEY',
                  fontWeight: '400',
                  wordWrap: 'break-word'
                }}>This isn&apos;t TRivia.      </span>
                <span className="text-4xl md:text-6xl lg:text-[64px] leading-[50px] md:leading-[60px] lg:leading-[76px]" style={{
                  color: 'var(--Yellow-500, #FFD60A)',
                  fontFamily: 'CHANEY',
                  fontWeight: '400',
                  wordWrap: 'break-word'
                }}>It&apos;s Taste.</span>
              </h1>
            </div>
            <div style={{
              width: '100%',
              maxWidth: '768px',
              paddingTop: '8px',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'flex'
            }}>
              <p className="text-sm md:text-lg leading-[20px] md:leading-[26px] px-4" style={{
                width: '100%',
                maxWidth: '724px',
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                wordWrap: 'break-word',
                margin: 0
              }}>
                Movie Draft challenges you to curate the perfect collection of films. Strategy meets cinema in this competitive drafting experience.
              </p>
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
            <h2 style={{
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'var(--Brand-Primary, #7142FF)',
              fontSize: '29.53px',
              fontFamily: 'Brockmann',
              fontWeight: '700',
              lineHeight: '36px',
              wordWrap: 'break-word',
              margin: 0
            }}>
              How to Play
            </h2>
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
                  <h3 style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.59px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    What is a Movie Draft?
                  </h3>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <p style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    Movie Draft is a competitive game where players take turns selecting movies based on a chosen theme. The goal is to build the highest-scoring collection of films!
                  </p>
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
                  <h3 style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.44px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    How to Set Up
                  </h3>
                </div>
                <ol style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '8px',
                  display: 'flex',
                  margin: 0,
                  paddingLeft: '20px',
                  listStyleType: 'decimal'
                }}>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Choose a draft theme (by Person or by Year)
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Select your specific option (actor/director or year)
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Add all players who will participate
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Choose your scoring categories and draft style
                  </li>
                </ol>
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
                  <h3 style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '17.97px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    How to Draft
                  </h3>
                </div>
                <ol style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '8px',
                  display: 'flex',
                  margin: 0,
                  paddingLeft: '20px',
                  listStyleType: 'decimal'
                }}>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Players take turns in order selecting movies
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Search and pick movies that match your theme
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Each player builds their roster of films
                  </li>
                  <li style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word'
                  }}>
                    Continue until everyone has selected their movies
                  </li>
                </ol>
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
                  <h3 style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Brand-Primary, #7142FF)',
                    fontSize: '18.13px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '28px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    Scoring
                  </h3>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}>
                  <p style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '400',
                    lineHeight: '20px',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    Movies are scored based on the categories you selected (IMDb rating, box office, critics scores, etc.). The player with the highest total score wins!
                  </p>
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
                <h3 style={{
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Brand-Primary, #7142FF)',
                  fontSize: '18.75px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '28px',
                  wordWrap: 'break-word',
                  margin: 0
                }}>
                  Pro Tips
                </h3>
              </div>
              <ul style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '8px',
                display: 'flex',
                margin: 0,
                paddingLeft: '20px',
                listStyleType: 'disc'
              }}>
                <li style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  wordWrap: 'break-word'
                }}>
                  Balance popular hits with hidden gems
                </li>
                <li style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  wordWrap: 'break-word'
                }}>
                  Pay attention to what others are selecting
                </li>
                <li style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  wordWrap: 'break-word'
                }}>
                  Have fun and discover new movies!
                </li>
              </ul>
            </div>
          </div>
        </section>
    </div>
    </>
  );
};

export default LearnMore;
