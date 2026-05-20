import { Helmet } from 'react-helmet-async';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { graphJsonLd, webPageNode } from '@/components/seo/jsonLd';
import { HomeDraftSection } from '@/components/home/HomeDraftSection';

const Home = () => {
  const { loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const id = location.hash?.replace(/^#/, '');
    if (id !== 'draft-setup') return;
    window.requestAnimationFrame(() => {
      document.getElementById('draft-setup')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [location.pathname, location.hash]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Movie Drafter – The Movie Draft Game for Friends</title>
        <meta name="description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <link rel="canonical" href="https://moviedrafter.com/" />
        <meta property="og:title" content="Movie Drafter – The Movie Draft Game for Friends" />
        <meta property="og:description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <meta property="og:url" content="https://moviedrafter.com/" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter – The Movie Draft Game for Friends" />
        <meta name="twitter:description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/',
                name: 'Movie Drafter – The Movie Draft Game for Friends',
                description:
                  'Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes.',
              })
            )
          )}
        </script>
      </Helmet>

      <div className="relative min-h-screen overflow-x-hidden">
        {/* Background Image - Absolutely Positioned to sit behind content */}
        <div
          style={{
            position: 'absolute',
            top: '-33px',
            left: '0',
            width: '100vw',
            height: '488px',
            backgroundImage: 'url(/bg-2014.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
            opacity: 0.8 
          }}
        />

        {/* Hero Section */}
        <section 
          className="w-full px-6 py-16 md:py-20 relative z-10"
        >
          {/* Main Content */}
          <div 
            className="relative z-10 w-full max-w-[1400px] mx-auto px-6 flex flex-col items-center gap-6"
          >
            {/* Heading */}
            <div className="w-full flex flex-col items-center">
              <h1 
                className="w-full text-center text-6xl md:text-7xl lg:text-[90px] leading-[70px] md:leading-normal lg:leading-[90px] font-chaney font-normal text-greyscale-blue-100"
                style={{ wordWrap: 'break-word' }}
              >
                Your Picks.<br /> Your glory.
              </h1>
            </div>

            {/* Description */}
            <div className="w-full max-w-[768px] pt-2 flex flex-col items-center">
              <p 
                className="w-full max-w-[724px] text-center text-sm md:text-lg font-brockmann font-medium leading-[20px] md:leading-[26px] text-greyscale-blue-100"
                style={{ wordWrap: 'break-word' }}
              >
                Turn your film obsession into friendly competition. Draft movies, rack up points, and settle once and for all who has the best taste in cinema.
              </p>
            </div>
          </div>
        </section>

        <HomeDraftSection draftSetupAnchorId="draft-setup" />
      </div>

      {/* SEO content section — keyword-rich, crawlable text for Google */}
      <section
        aria-label="About Movie Drafter"
        className="w-full px-6 py-16"
        style={{ background: '#0E0E0F' }}
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              The movie draft game for film lovers
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Movie Drafter is a free online movie draft game that lets you and your friends compete over
              cinema taste. Think of it like the NFL Draft — but instead of picking athletes, you're
              drafting films. Each player takes turns claiming movies into category slots, and whoever
              builds the highest-scoring roster wins. No trivia required: it's all about strategy and taste.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Draft by Filmography
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Pick a director, actor, or writer and draft from their entire body of work. Compete to
                claim the best films in their catalog before your friends do. Great for auteur-focused
                film fans who love Spielberg, Nolan, Scorsese, or any other filmmaker's complete filmography.
              </p>
              <a
                href="/draft-by-filmography"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Learn about filmography drafts →
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Draft by Year
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Choose a release year and draft from every film that came out that year. Draft the best
                movies of 1994, 2007, or any year in cinema history. A brilliant format for groups who
                love debating the strongest year in film.
              </p>
              <a
                href="/draft-by-year"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Learn about year drafts →
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Special Drafts
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Browse curated themed draft pools — 80s action movies, A24 films, Oscar winners, rom-coms,
                and more. Each special draft has a hand-picked list of eligible films so everyone is
                competing on the same level playing field.
              </p>
              <a
                href="/special-draft"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Browse special drafts →
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              How the movie draft game works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  1. Choose your draft format
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Pick from Draft by Filmography (an actor or director's catalog), Draft by Year (all films from
                  a specific year), or a Special Draft with a curated theme like 90s thrillers or Best Picture winners.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  2. Add your friends
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Play locally with everyone on one device, or invite friends via email to an online multiplayer
                  draft. Each player gets their own picks sent to their inbox.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  3. Draft your roster
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Take turns selecting movies into category slots like "Best Reviewed," "Biggest Box Office," or
                  "Most Oscar Nominations." Strategy counts — the movie you want might get snatched before your pick.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  4. See who wins
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Movie Drafter automatically scores each roster using real data — box office, critic scores,
                  IMDb ratings, and award wins. The player with the best film slate wins bragging rights.
                </p>
              </div>
            </div>
            <a
              href="/how-to-draft"
              className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300 w-fit"
            >
              Read the complete how-to-draft guide →
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              Why play Movie Drafter?
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Movie Drafter is the only free movie drafting game built specifically for film enthusiasts.
              Unlike movie trivia games, there are no right or wrong answers — just competing taste and strategy.
              It's the perfect movie game for friends on a group chat, film club nights, or any gathering where
              everyone has opinions about cinema. Draft movies with friends online in minutes, or play in-person
              with everyone on the same screen.
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              With hundreds of filmographies, every year in cinema history, and growing library of curated special
              drafts, there's always a new movie picking competition waiting. Start your first fantasy movie draft
              today — no account required.
            </p>
            <a
              href="/faq"
              className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300 w-fit"
            >
              Frequently asked questions →
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
