import { Helmet } from 'react-helmet-async';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { graphJsonLd, webPageNode } from '@/components/seo/jsonLd';
import { HomeDraftSection } from '@/components/home/HomeDraftSection';
import { LeagueFeatureSection } from '@/components/home/LeagueFeatureSection';
import { HowItWorksSection } from '@/components/home/HowItWorksSection';
import { RotatingFilmographyPortrait } from '@/components/home/RotatingFilmographyPortrait';
import { RotatingYearDraftPortrait } from '@/components/home/RotatingYearDraftPortrait';
import Spline from '@splinetool/react-spline';

const Home = () => {
  const { loading } = useAuth();
  const location = useLocation();
  const splineWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!splineWrapperRef.current) return;
      const y = window.scrollY;
      splineWrapperRef.current.style.transform = `translateX(-50%) translateY(calc(-50% + ${y * 0.5}px))`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <div style={{ color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px' }}>Loading...</div>
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

      {/* ── 1. Hero ── */}
      <div className="relative w-full min-h-screen">
        {/* pointer-events: none on the text section so hover passes through to Spline */}
        <section className="w-full px-6 py-16 md:py-20 relative z-10 overflow-visible">
          <div
            ref={splineWrapperRef}
            style={{
              position: 'absolute',
              top: 'calc(50% + 300px)',
              left: '50%',
              transform: 'translateX(-50%) translateY(-50%)',
              width: '100vw',
              height: '100vh',
              zIndex: 0,
              opacity: 0.6,
            }}
          >
            <Spline
              scene="https://prod.spline.design/K4NCn3QQ5YqLqGGU/scene.splinecode"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 flex flex-col items-center gap-6" style={{ pointerEvents: 'none' }}>
            <div className="w-full flex flex-col items-center">
              <h1
                className="w-full text-center text-6xl md:text-7xl lg:text-[90px] leading-[70px] md:leading-normal lg:leading-[90px] font-chaney font-normal text-greyscale-blue-100"
                style={{ wordWrap: 'break-word' }}
              >
                Your Picks.<br /> Your glory.
              </h1>
            </div>
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

        {/* ── 2. Draft setup form ── */}
        <HomeDraftSection draftSetupAnchorId="draft-setup" />

        {/* Scroll indicator */}
        <div className="flex flex-col items-center gap-2 py-8 opacity-60">
          <span className="font-brockmann text-[11px] font-medium tracking-[0.2em] text-[#BDC3C2] uppercase">
            Scroll to learn more
          </span>
          <svg
            className="animate-bounce"
            width="18" height="18" viewBox="0 0 18 18" fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 6.5L9 11.5L14 6.5" stroke="#BDC3C2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* ── 3. How it works (carousel + Spline) ── */}
      <HowItWorksSection />

      {/* ── 4. About section ── */}
      <section
        aria-label="About Movie Drafter"
        className="w-full px-6 py-16"
        style={{ background: '#0E0E0F' }}
      >
        <div className="max-w-[896px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-5 items-center text-center">
            <h2 className="m-0 font-chaney font-normal text-3xl lg:text-[36px] leading-[36px] text-[#FAFEFF]">
              The movie draft game for film lovers
            </h2>
            <p className="m-0 font-brockmann text-base leading-7 text-[#BBC3BF] max-w-[893px]">
              Movie Drafter is a free online movie draft game that lets you and your friends compete over
              cinema taste. Think of it like a Fantasy Sports Draft — but instead of picking athletes, you're
              drafting films. Each player takes turns claiming movies into category slots, and whoever
              builds the highest-scoring roster wins. No trivia required: it's all about strategy and taste.
            </p>
          </div>

          <div className="flex flex-col gap-9">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-start gap-6">
                <RotatingFilmographyPortrait />
                <div className="flex flex-col gap-3">
                  <h3 className="m-0 font-brockmann font-semibold text-lg text-[#837AFF]">
                    Draft by Filmography
                  </h3>
                  <p className="m-0 font-brockmann text-sm leading-relaxed text-[#BBC3BF]">
                    Pick a director, actor, or writer and draft from their entire body of work. Compete to
                    claim the best films in their catalog before your friends do. Great for auteur-focused
                    film fans who love Spielberg, Nolan, Scorsese, or any other filmmaker's complete filmography.
                  </p>
                  <a
                    href="/draft-by-filmography"
                    className="inline-flex items-center gap-2 text-sm font-brockmann font-medium text-[#BCB2FF] border border-[#BCB2FF] rounded-[2px] px-3 py-2 w-fit hover:bg-[#BCB2FF]/10 transition-colors"
                  >
                    Filmography Draft Guide →
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <RotatingYearDraftPortrait />
                <div className="flex flex-col gap-3">
                  <h3 className="m-0 font-brockmann font-semibold text-lg text-[#837AFF]">
                    Draft by Year
                  </h3>
                  <p className="m-0 font-brockmann text-sm leading-relaxed text-[#BBC3BF]">
                    Choose a release year and draft from every film that came out that year. Draft the best
                    movies of 1994, 2007, or any year in cinema history. A brilliant format for groups who
                    love debating the strongest year in film.
                  </p>
                  <a
                    href="/draft-by-year"
                    className="inline-flex items-center gap-2 text-sm font-brockmann font-medium text-[#BCB2FF] border border-[#BCB2FF] rounded-[2px] px-3 py-2 w-fit hover:bg-[#BCB2FF]/10 transition-colors"
                  >
                    Year Draft Guide →
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-center text-center">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-[#837AFF]">
                Special Drafts
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-[#BBC3BF] max-w-2xl">
                Browse curated themed draft pools — 80s action movies, A24 films, Oscar winners, rom-coms,
                and more. Each special draft has a hand-picked list of eligible films so everyone is
                competing on the same level playing field.
              </p>
              <a
                href="/special-draft"
                className="inline-flex items-center gap-2 text-sm font-brockmann font-medium text-[#BCB2FF] border border-[#BCB2FF] rounded-[2px] px-3 py-2 w-fit hover:bg-[#BCB2FF]/10 transition-colors"
              >
                Browse Special Drafts →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. League feature ── */}
      <LeagueFeatureSection />

      {/* ── 6. Why play ── */}
      <section
        aria-label="Why play Movie Drafter"
        className="w-full px-6 py-16"
        style={{ background: '#0E0E0F' }}
      >
        <div className="max-w-[896px] mx-auto flex flex-col gap-5">
          <h2 className="m-0 font-chaney font-normal text-3xl lg:text-[36px] leading-[36px] text-[#FAFEFF]">
            Why play Movie Drafter?
          </h2>
          <p className="m-0 font-brockmann text-base leading-7 text-[#BBC3BF]">
            Movie Drafter is the only free movie drafting game built specifically for film enthusiasts.
            Unlike movie trivia games, there are no right or wrong answers — just competing taste and strategy.
            It's the perfect movie game for friends on a group chat, film club nights, or any gathering where
            everyone has opinions about cinema. Draft movies with friends online in minutes, or play in-person
            with everyone on the same screen.
          </p>
          <p className="m-0 font-brockmann text-base leading-7 text-[#BBC3BF]">
            With hundreds of filmographies, every year in cinema history, and growing library of curated special
            drafts, there's always a new movie picking competition waiting. Start your first fantasy movie draft
            today — no account required.
          </p>
          <a
            href="/faq"
            className="inline-flex items-center gap-2 text-sm font-brockmann font-medium text-[#BCB2FF] border border-[#BCB2FF] rounded-[2px] px-3 py-2 w-fit hover:bg-[#BCB2FF]/10 transition-colors"
          >
            Frequently Asked Questions →
          </a>
        </div>
      </section>
    </>
  );
};

export default Home;
