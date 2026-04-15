import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { articleNode, breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';

const SITE = 'https://moviedrafter.com';

const HowToDraftPage = () => {
  const pageTitle = 'Movie Drafter - How to draft movies (rules, scoring & tips)';
  const pageDesc =
    'Complete guide to the movie drafting game: how picks work, category rules, scoring ideas, multiplayer flow, and why fantasy movie drafts are fun with friends.';
  const articleHeadline = 'How to draft movies (rules, scoring & tips)';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/how-to-draft`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/how-to-draft`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              articleNode({
                path: '/how-to-draft',
                headline: articleHeadline,
                description: pageDesc,
              }),
              breadcrumbListNode([
                { name: 'Home', path: '/' },
                { name: 'How to draft movies', path: '/how-to-draft' },
              ])
            )
          )}
        </script>
      </Helmet>

      <article
        className="min-h-screen w-full"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <p className="m-0 text-sm font-brockmann text-purple-300">
              <Link to="/learn-more" className="underline hover:text-purple-200">
                ← Back to Learn More
              </Link>
            </p>
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              How to draft movies
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              A practical, plain-language guide to the movie drafting game on Movie Drafter—what you&apos;re
              trying to do, how turns and categories work, how scoring usually plays out, and why groups
              keep coming back for another fantasy movie draft.
            </p>
          </header>

          <div className="flex flex-col gap-10 font-brockmann text-greyscale-blue-100 text-base leading-relaxed">
            <section aria-labelledby="what-heading">
              <h2 id="what-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                What is a movie draft?
              </h2>
              <p className="m-0 mb-3">
                A movie draft is a structured game where each player builds a <strong>roster</strong> of films
                by taking turns picking movies into <strong>category slots</strong>—similar to a sports draft,
                but the athletes are A24 indies, summer blockbusters, or whatever your group agrees fits the
                board. Movie Drafter is the cinema drafting tool that keeps picks organized, validates
                eligibility, and (when you&apos;re done) helps you compare results.
              </p>
              <p className="m-0">
                You can run drafts around a <strong>person</strong> (everyone pulls from the same filmography),
                a <strong>release year</strong>, or a <strong>special theme</strong> with a curated pool—see our{' '}
                <Link to="/special-draft" className="text-purple-300 underline hover:text-purple-200">
                  theme guides
                </Link>{' '}
                for indexable examples with real titles.
              </p>
            </section>

            <section aria-labelledby="flow-heading">
              <h2 id="flow-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                Setup: players, categories, and the snake draft
              </h2>
              <p className="m-0 mb-3">
                Before picks begin, the host chooses <strong>how many people</strong> are playing (including AI
                seats if you want filler), and which <strong>categories</strong> each roster must fill. A
                category might be broad (&quot;Comedy&quot;) or narrow (&quot;Sequel&quot;, &quot;90&apos;s&quot;,
                &quot;Academy Award Nominee or Winner&quot;) depending on the vibe you want.
              </p>
              <p className="m-0 mb-3">
                Movie Drafter uses a <strong>snake draft</strong> order: if Player A picks first in round one,
                they pick last in round two, then first again in round three, and so on. That keeps early picks
                powerful but prevents one person from running away with every premium slot.
              </p>
              <p className="m-0">
                On your turn you&apos;ll see eligible movies for the active category. The app blocks picks that
                don&apos;t qualify, so arguments shift from &quot;does that count?&quot; to strategy and taste.
              </p>
            </section>

            <section aria-labelledby="multi-heading">
              <h2 id="multi-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                Local couch draft vs multiplayer
              </h2>
              <p className="m-0 mb-3">
                <strong>Local mode</strong> is perfect for one device passed around the room—great for parties
                and podcasts. <strong>Multiplayer</strong> gives each person a link so they draft from their own
                phone or laptop on their own schedule; the board updates as picks lock in.
              </p>
              <p className="m-0">
                Both modes follow the same rules; multiplayer just adds invites, guest sessions, and async
                pacing so your fantasy movie draft doesn&apos;t require everyone online at once.
              </p>
            </section>

            <section aria-labelledby="score-heading">
              <h2 id="score-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                Scoring: how winners emerge
              </h2>
              <p className="m-0 mb-3">
                After the board is full, Movie Drafter scores each film using signals tied to the categories you
                turned on—think IMDb-style audience ratings, box office where available, critic aggregates, and
                similar metrics. Each category emphasizes different skills: some reward bold indie picks, others
                reward crowd-pleasers that still clear a quality bar.
              </p>
              <p className="m-0 mb-3">
                The player whose roster earns the <strong>highest combined total</strong> wins the draft. Ties are
                rare but possible; use house rules (sudden-death re-watch night?) if you need a tiebreaker.
              </p>
              <p className="m-0">
                Scoring is designed to be transparent enough to debate and spicy enough to matter—if you want
                bragging rights, pick movies you&apos;ll defend at brunch.
              </p>
            </section>

            <section aria-labelledby="fun-heading">
              <h2 id="fun-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                Why movie drafting is fun
              </h2>
              <ul className="m-0 pl-5 list-disc space-y-2">
                <li>
                  <strong>It surfaces taste.</strong> You learn who values spectacle, who mines deep cuts, and
                  who always drafts the same comfort watch.
                </li>
                <li>
                  <strong>It sparks recommendations.</strong> Half the joy is adding new titles to your watchlist
                  after seeing someone steal a gem you forgot existed.
                </li>
                <li>
                  <strong>It scales with your group.</strong> Casual friends can keep categories broad; cinephiles
                  can stack decade + genre + awards constraints for a knife fight.
                </li>
                <li>
                  <strong>It&apos;s replayable.</strong> New themes, new years, new special drafts—every board is a
                  different puzzle.
                </li>
              </ul>
            </section>

            <section aria-labelledby="tips-heading">
              <h2 id="tips-heading" className="m-0 mb-3 font-brockmann font-semibold text-xl text-greyscale-blue-50">
                Quick strategy tips
              </h2>
              <ol className="m-0 pl-5 list-decimal space-y-2">
                <li>
                  <strong>Map the board early.</strong> If a scarce category only has a few obvious hits, don&apos;t
                  wait until your last turn to address it.
                </li>
                <li>
                  <strong>Watch the snake.</strong> You might get two picks back-to-back at the turn—plan pairs of
                  films that complement each other.
                </li>
                <li>
                  <strong>Mix certainty and upside.</strong> Lock safe points in one slot, swing for a wild card
                  in another.
                </li>
                <li>
                  <strong>Use theme guides for research.</strong> Our{' '}
                  <Link to="/special-draft" className="text-purple-300 underline hover:text-purple-200">
                    curated lists
                  </Link>{' '}
                  are a fast way to seed ideas before you enter the room.
                </li>
              </ol>
            </section>

            <section
              className="rounded-lg border border-greyscale-purp-700 bg-greyscale-purp-900/50 p-6 flex flex-col gap-4 items-start"
              aria-label="Call to action"
            >
              <h2 className="m-0 font-brockmann font-semibold text-lg text-greyscale-blue-50">
                Ready to run your first draft?
              </h2>
              <p className="m-0 text-greyscale-blue-100">
                Start from the home page to pick a theme, or jump straight into a special draft if you already
                know the pool you want.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-brand-primary text-primary-foreground hover:bg-brand-primary/90 h-10 px-6 rounded-[2px] font-brockmann transition-colors"
                >
                  <Link to="/">Start a draft</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="bg-greyscale-purp-850 border-greyscale-purp-700 text-greyscale-blue-100 hover:bg-greyscale-purp-800 hover:text-greyscale-blue-50 h-10 px-6 rounded-[2px] transition-colors font-brockmann"
                >
                  <Link to="/special-draft">Browse special draft film lists</Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </article>
    </>
  );
};

export default HowToDraftPage;
