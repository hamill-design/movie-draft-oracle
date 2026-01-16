import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Movie Drafter - About</title>
        <meta name="description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta property="og:title" content="Movie Drafter - About" />
        <meta property="og:description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta property="og:url" content="https://moviedrafter.com/about" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - About" />
        <meta name="twitter:description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
      <div 
        className="min-h-screen w-full flex flex-col items-center justify-start"
        style={{
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingTop: '48px',
          paddingBottom: '32px',
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'
        }}
      >
        <div className="w-full max-w-[880px] flex flex-col items-start justify-start gap-5">
          {/* Main Content */}
          <div className="w-full flex flex-col items-start justify-start gap-10">
            {/* Header Section */}
            <div className="w-full flex flex-col items-start justify-start gap-5">
              <div className="w-full flex flex-col items-center justify-start gap-1.5">
                <div 
                  className="w-full flex flex-col justify-center text-center"
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '48px',
                    fontFamily: 'CHANEY',
                    fontWeight: 400,
                    lineHeight: '50px'
                  }}
                >
                  About Movie Drafter
                </div>
                <div 
                  className="flex flex-col justify-center text-center"
                  style={{
                    color: 'hsl(var(--purple-300))',
                    fontSize: '20px',
                    fontFamily: 'Brockmann',
                    fontWeight: 500,
                    lineHeight: '28px'
                  }}
                >
                  Where Strategy Meets Cinema
                </div>
              </div>

              {/* Content */}
              <div className="w-full flex flex-col justify-center">
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Movie Drafter is a competitive fantasy movie drafting platform that transforms your love of cinema into an engaging, strategic game. Whether you're a casual movie fan or a cinephile, Movie Drafter challenges you to curate the perfect collection of films and compete with friends.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Our Mission
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  We want to build community within the movie going community. Let's get people more excited about the movies they like, and have a conversation about the ones they should know. Movie trivia is fun, but sometimes can be an inaccessible knowledge curve. By adding the fun of strategy, we're making a more competitive, satisfying and communal game for new and experienced movie fans alike. Movie Drafter brings together friends and film enthusiasts to compete in drafting the best movie collections based on a mesh of metrics like box office performance, critical acclaim, and audience ratings.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  How It Works
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Movie Drafter allows you to create custom movie drafts with your friends. Choose from themes like drafting movies by a specific actor, director, or year. Select your categories based on genre or timeframe, and fill those slots (like a player in a position) and fill out your roster. Once all the lists are full we'll provide you with a score to see who really has the best taste in movies.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Features
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Custom Drafts</span> Create drafts based on actors, directors, or years
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Real-Time Competition</span> Draft with friends in real-time or asynchronously
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Comprehensive Movie Database</span> Powered by TMDB, access thousands of films
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Detailed Analytics</span> Track your performance and see how your picks stack up
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Powered by TMDB
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Movie Drafter uses data from{" "}
                  <a 
                    href="https://www.themoviedb.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    The Movie Database (TMDB)
                  </a>
                  {" "}to provide comprehensive movie information, ratings, and metadata. We're grateful for their open API that makes this platform possible.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Get Started
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Ready to start drafting?{" "}
                  <a 
                    href="/learn-more" 
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    Learn more about how to play
                  </a>
                  {" "}or create your first draft and invite your friends to compete!
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Contact Us
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px'
                  }}
                >
                  Have questions, feedback, or suggestions? We'd love to hear from you! Reach out through our{" "}
                  <button
                    onClick={() => navigate("/contact")}
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'Brockmann',
                      fontSize: '14px',
                      fontWeight: 400
                    }}
                  >
                    Contact Support
                  </button>
                  {" "}page or follow us on{" "}
                  <a 
                    href="https://www.instagram.com/moviedrafter/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    Instagram
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* A Note from the creator */}
            <div className="w-full flex flex-col items-start justify-start gap-3">
              <div 
                className="w-full flex flex-col justify-center"
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '36px',
                  fontFamily: 'CHANEY',
                  fontWeight: 400,
                  lineHeight: '36px'
                }}
              >
                A Note from the creator
              </div>
              <div 
                className="w-full flex flex-col justify-center"
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14.80px',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  lineHeight: '24px'
                }}
              >
                Hey there you little Movie Hog, my name is Robert Hamill. I started this project after I realized there was no conclusive way to score movie drafts, a la The Big Picture podcast. Overtime I realized I could bring this tool to more movie fans and give them the opportunity to participate in their own games. Further, we could learn what movies people feel more affection towards and give us data driven insights as to what people are looking for in the moment. I have a loose roadmap for this baby, including leagues, voting, and of course a native mobile app. I'm very excited about this and a couple other projects I would like to get in production for an enterprise that will, hopefully, get people off the couch and into the movie theater with friends new and old.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default About;
