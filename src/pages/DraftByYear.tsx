import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { articleNode, breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';

const SITE = 'https://moviedrafter.com';

const GREAT_YEARS = [
  { year: '1994', note: 'Pulp Fiction, Shawshank, Forrest Gump, The Lion King, Speed' },
  { year: '1999', note: 'Fight Club, The Matrix, American Beauty, Magnolia, Eyes Wide Shut' },
  { year: '2007', note: 'No Country for Old Men, There Will Be Blood, Zodiac, Into the Wild' },
  { year: '1999', note: 'Fight Club, The Matrix, Being John Malkovich, Election, The Sixth Sense' },
  { year: '1974', note: 'Chinatown, The Godfather Part II, Blazing Saddles, Young Frankenstein' },
  { year: '2014', note: 'Boyhood, Nightcrawler, Whiplash, Interstellar, Gone Girl' },
  { year: '1982', note: 'E.T., Blade Runner, The Thing, Gandhi, Tootsie, Fast Times' },
  { year: '2019', note: 'Parasite, Once Upon a Time in Hollywood, Uncut Gems, The Lighthouse' },
].filter((v, i, a) => a.findIndex(x => x.year === v.year) === i); // dedupe

const DraftByYear = () => {
  const pageTitle = 'Draft Movies by Year – Pick Films From Any Year in Cinema History';
  const pageDesc =
    'Draft movies from any year in cinema history. Compete with friends to claim the best films of 1994, 1999, 2007, or any release year. The ultimate movie year draft game.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/draft-by-year`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/draft-by-year`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              articleNode({
                path: '/draft-by-year',
                headline: 'Draft movies by year — pick films from any year in cinema history',
                description: pageDesc,
              }),
              breadcrumbListNode([
                { name: 'Home', path: '/' },
                { name: 'Draft by Year', path: '/draft-by-year' },
              ])
            )
          )}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12">

          <header className="flex flex-col gap-4">
            <p className="m-0 text-sm font-brockmann text-purple-300">
              <Link to="/" className="underline hover:text-purple-200">
                ← Back to Movie Drafter
              </Link>
            </p>
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              Draft movies by year
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              Pick any year from 1939 to the present — then compete with friends to draft the best films
              from that release year. The movie draft game that finally settles which year in cinema was
              actually the greatest.
            </p>
            <Link
              to="/"
              className="inline-block w-fit bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
            >
              Start a year draft
            </Link>
          </header>

          <section aria-labelledby="what-heading" className="flex flex-col gap-4">
            <h2 id="what-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              What is a movie year draft?
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              A movie year draft is a fantasy film draft game where all eligible movies are limited to
              a single release year. Choose a year — say, 1994 or 2007 — and every player drafts from
              that year's entire output. Because every film came out in the same year, you're genuinely
              competing over the same pool with no home-field advantage.
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Year drafts are fantastic for groups who love debating "what was the greatest year in
              film" — now you can back your argument with a real draft and real scores.
            </p>
          </section>

          <section aria-labelledby="how-heading" className="flex flex-col gap-6">
            <h2 id="how-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              How to run a year draft
            </h2>
            <div className="flex flex-col gap-6">
              {[
                {
                  step: '1',
                  title: 'Choose your year',
                  body: 'Pick any year from 1939 to the present from Movie Drafter\'s year selector. The game immediately loads every eligible film from that year — from blockbusters to foreign language films to cult classics.',
                },
                {
                  step: '2',
                  title: 'Add your friends',
                  body: 'Play locally (everyone on one device) or invite friends via email to join a multiplayer year draft. Remote players receive an email link and can make picks on their own schedule.',
                },
                {
                  step: '3',
                  title: 'Set your scoring categories',
                  body: 'Customize how movies are scored — IMDb rating, box office, critic scores, Oscar nominations, audience rating, and more. Each category slot rewards the player with the best-performing film in that metric.',
                },
                {
                  step: '4',
                  title: 'Draft and settle the debate',
                  body: 'Take turns drafting films into your roster. When everyone has filled their slots, Movie Drafter calculates the scores automatically. See whose picks held up — and whose bold sleeper pick flopped.',
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex gap-4">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-brockmann font-bold text-sm text-white"
                  >
                    {step}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                      {title}
                    </p>
                    <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="years-heading" className="flex flex-col gap-4">
            <h2 id="years-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              Great years to draft
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Some years are loaded with all-timers. Here are a few that consistently produce the best
              movie draft battles:
            </p>
            <div className="flex flex-col gap-3">
              {GREAT_YEARS.map(({ year, note }) => (
                <div key={year} className="flex gap-3 items-start">
                  <span className="shrink-0 font-brockmann font-bold text-sm text-purple-300 w-10">
                    {year}
                  </span>
                  <span className="font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                    {note}
                  </span>
                </div>
              ))}
            </div>
            <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-400 italic">
              Movie Drafter covers every year from 1939 onwards — older years can be just as contentious as modern ones.
            </p>
          </section>

          <section aria-labelledby="why-heading" className="flex flex-col gap-4">
            <h2 id="why-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              Why year drafts spark the best debates
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              The "what was the best year in movies" argument is one of the most common in any film fan
              group chat. A year draft turns that conversation into a game with stakes. Everyone enters
              confident their year has depth — and then discovers that the movie they assumed was safely
              theirs just got stolen on the pick before theirs.
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Year drafts also surface films that wouldn't normally come up in conversation. Drafting
              1999 forces you to think beyond <em>Fight Club</em> and <em>The Matrix</em> — suddenly you're
              debating whether <em>Election</em>, <em>Magnolia</em>, or <em>Eyes Wide Shut</em> is
              more valuable as a draft pick. That's when it gets really fun.
            </p>
          </section>

          <div
            className="flex flex-col gap-4 p-6 rounded-lg"
            style={{ background: '#160038', outline: '1px solid #3B0394', outlineOffset: '-1px' }}
          >
            <h2 className="m-0 font-brockmann font-bold text-xl text-greyscale-blue-50">
              Start your year draft now
            </h2>
            <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
              No account needed. Pick a year, add your friends, and start drafting in minutes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-block bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
              >
                Start a year draft
              </Link>
              <Link
                to="/how-to-draft"
                className="inline-block text-greyscale-blue-100 font-brockmann font-medium px-4 py-3 text-sm underline hover:text-greyscale-blue-50 transition-colors"
              >
                Read the full how-to guide
              </Link>
            </div>
          </div>

          <nav aria-label="Other draft formats" className="flex flex-col gap-3">
            <p className="m-0 font-brockmann font-semibold text-sm text-greyscale-blue-300 uppercase tracking-wider">
              Other draft formats
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/draft-by-filmography"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Draft by Filmography →
              </Link>
              <Link
                to="/special-draft"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Special Drafts →
              </Link>
              <Link
                to="/faq"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                FAQ →
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default DraftByYear;
