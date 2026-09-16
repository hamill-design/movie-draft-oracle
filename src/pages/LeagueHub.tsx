import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { breadcrumbListNode, graphJsonLd, webPageNode } from '@/components/seo/jsonLd';
import { useAuth } from '@/contexts/AuthContext';
import { MOVIE_DRAFTER_PURPLE_SHELL } from '@/lib/pageGradients';
import leagueTrophyIllustration from '@/assets/illustrations/illus/league-trophy.svg';
import leagueStandingsIllustration from '@/assets/illustrations/illus/league-standings.png';

const SITE = 'https://moviedrafter.com';

const LeagueHub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pageTitle = 'Movie Drafter - Leagues (rules, scoring & seasons)';
  const pageDesc =
    'How Movie Drafter leagues work: F1-style scoring, all-time standings, and the universal quarterly season system. Create a league and compete with friends across every draft.';

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Leagues', path: '/league' },
  ];

  // Signed-in players go straight to the create form; signed-out players go
  // through auth first and land on /league/create right after.
  const handleGoToCreateLeague = () => {
    if (user) {
      navigate('/league/create');
    } else {
      navigate(`/auth?returnTo=${encodeURIComponent('/league/create')}`);
    }
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/league`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/league`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/league',
                name: 'Movie Drafter Leagues',
                description: pageDesc,
              }),
              breadcrumbListNode(crumbs)
            )
          )}
        </script>
      </Helmet>

      <div className="min-h-screen w-full" style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
          <header className="flex flex-col sm:flex-row items-center justify-center gap-8 p-6">
            <div className="relative h-[148px] w-[156px] shrink-0">
              <img
                src={leagueTrophyIllustration}
                alt=""
                width={156}
                height={148}
                decoding="async"
                className="h-full w-full object-contain object-center"
              />
            </div>
            <div className="flex flex-1 flex-col items-start gap-6">
              <div className="flex flex-col items-start gap-4">
                <h1 className="m-0 font-chaney text-4xl sm:text-5xl font-normal leading-tight text-greyscale-blue-100">
                  LEAGUES
                </h1>
                <p className="m-0 max-w-[530px] font-brockmann text-lg sm:text-xl font-medium leading-relaxed text-greyscale-blue-100">
                  Take your movie competitions to the next level. Compete with friends across multiple
                  drafts. You&apos;ll be the league admin and can invite members after setup.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoToCreateLeague}
                className="inline-flex items-center justify-center rounded-[2px] bg-[#FFD60A] px-[18px] py-3 text-center text-base font-semibold leading-6 tracking-[0.32px] text-[#2B2D2D] transition-colors hover:bg-[#e6c109] font-brockmann"
              >
                Go To Create League
              </button>
            </div>
          </header>

          <div className="flex flex-col gap-10 font-brockmann text-greyscale-blue-100 text-base leading-relaxed">
            <section aria-labelledby="what-heading">
              <h2 id="what-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                What is a Movie Drafter League?
              </h2>
              <p className="m-0">
                A one-off draft ends when the picks are locked in. A <strong>league</strong> is different —
                it's a standing group that runs as many drafts as it wants over time, with every result
                rolling up into shared standings. Same friends, running competition, bragging rights that
                actually accumulate.
              </p>
            </section>

            <section aria-labelledby="scoring-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-start">
              <img
                src={leagueStandingsIllustration}
                alt=""
                loading="lazy"
                className="w-full rounded-xl"
              />
              <div className="min-w-0">
                <h2 id="scoring-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                  Scoring & standings
                </h2>
                <p className="m-0 mb-3">
                  Every completed draft in a league is scored like a race finish: the roster with the
                  highest total wins the draft, and each player earns <strong>league points</strong> based on
                  where they placed —
                </p>
                <ul className="m-0 mb-3 pl-5 list-disc space-y-1">
                  <li>1st — 10 points</li>
                  <li>2nd — 7 points</li>
                  <li>3rd — 5 points</li>
                  <li>4th — 3 points</li>
                  <li>5th — 2 points</li>
                  <li>6th and beyond — 1 point</li>
                </ul>
                <p className="m-0">
                  Those points add up into the league's standings — your raw movie score sticks around too,
                  as a tiebreaker. Standings can be viewed <strong>all-time</strong> or narrowed to a single
                  season.
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-6">
              <div>
                <h2 id="seasons-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                  Seasons: quarterly, automatic
                </h2>
                <p className="m-0 mb-3">
                  Every league now runs on the same <strong>universal season system</strong>: the calendar
                  year split into four quarters —
                </p>
                <ul className="m-0 mb-3 pl-5 list-disc space-y-1">
                  <li>Q1 (January–March)</li>
                  <li>Q2 (April–June)</li>
                  <li>Q3 (July–September)</li>
                  <li>Q4 (October–December)</li>
                </ul>
                <p className="m-0">
                  There's nothing to set up. A draft's season is simply whichever quarter it's scheduled or
                  played in, so standings sort themselves automatically — flip between the current quarter
                  and all-time on your league page whenever you want.
                </p>
              </div>

              <div>
                <h2 id="drafts-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                  Running drafts in a league
                </h2>
                <p className="m-0">
                  A league admin can schedule a draft ahead of time — pick a date, time, and draft type
                  (by filmmaker, by year, a special draft, or classic) — and members join in when the room
                  opens. Standings and the season view update the moment a draft finishes.
                </p>
              </div>

              <div>
                <h2 id="roles-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                  Roles & invites
                </h2>
                <p className="m-0">
                  Whoever creates the league is its <strong>admin</strong> — they can schedule drafts, rename
                  the league, and manage members. Leagues are invite-only: the admin invites people by email,
                  and they join with one click from the invite.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default LeagueHub;
