import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { articleNode, breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const SITE = 'https://moviedrafter.com';

const DraftByFilmography = () => {
  const pageTitle = 'Draft Movies by Filmography – Pick Films From Any Director or Actor';
  const pageDesc =
    'Draft movies from any actor, director, or writer\'s full filmography. A competitive movie draft game where friends compete to claim the best films in a filmmaker\'s catalog.';

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Draft by Filmography', path: '/draft-by-filmography' },
  ];

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/draft-by-filmography`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/draft-by-filmography`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              articleNode({
                path: '/draft-by-filmography',
                headline: 'Draft movies by filmography — pick films from any director or actor',
                description: pageDesc,
              }),
              breadcrumbListNode(crumbs)
            )
          )}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12">
          <Breadcrumbs items={crumbs} />

          <header className="flex flex-col gap-4">
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              Draft movies by filmography
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              Choose any actor, director, or writer — then compete with friends to draft the best films
              from their entire career. It's the ultimate movie picking game for film fans who can't stop
              arguing about filmographies.
            </p>
            <Link
              to="/"
              className="inline-block w-fit bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
            >
              Start a filmography draft
            </Link>
          </header>

          <section aria-labelledby="what-heading" className="flex flex-col gap-4">
            <h2 id="what-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              What is a filmography draft?
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              A filmography draft is a movie draft game format where the entire pool of eligible films
              comes from one filmmaker's body of work. Search for a director like Christopher Nolan, an
              actor like Meryl Streep, or a writer like Charlie Kaufman — and every player drafts from
              that catalog.
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Because everyone is pulling from the same filmography, the draft is intensely competitive.
              The movie you want might get taken on the pick before yours. Knowing a director's full
              body of work — including the hidden gems — is a real advantage.
            </p>
          </section>

          <section aria-labelledby="how-heading" className="flex flex-col gap-6">
            <h2 id="how-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              How to run a filmography draft
            </h2>
            <div className="flex flex-col gap-6">
              {[
                {
                  step: '1',
                  title: 'Search for a filmmaker',
                  body: 'Type any actor, director, or writer\'s name into Movie Drafter\'s search. The game pulls their complete filmography from our movie database, so you get every credit — blockbusters, cult classics, and deep cuts alike.',
                },
                {
                  step: '2',
                  title: 'Add your friends',
                  body: 'Add 2 or more participants. Play locally (everyone on one screen) or send email invitations for an online multiplayer filmography draft. Remote players get a link to join and make their picks.',
                },
                {
                  step: '3',
                  title: 'Set your scoring categories',
                  body: 'Choose how movies are scored: IMDb rating, box office gross, Rotten Tomatoes score, Oscar nominations, audience vote, and more. Each category slot rewards the player who claimed the strongest film for that metric.',
                },
                {
                  step: '4',
                  title: 'Draft and compete',
                  body: 'Take turns picking films into your roster. Each movie can only be claimed once — strategy is everything. When all picks are in, Movie Drafter tallies the scores automatically.',
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

          <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
            <h2 id="ideas-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              Great filmography draft ideas
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Not sure who to draft? Here are some filmographies that generate the most debate:
            </p>
            <ul className="m-0 pl-5 flex flex-col gap-2">
              {[
                'Directors: Spielberg, Scorsese, Kubrick, Tarantino, P.T. Anderson, Greta Gerwig, Ari Aster',
                'Actors: Meryl Streep, Tom Hanks, Denzel Washington, Cate Blanchett, Daniel Day-Lewis',
                'Prolific character actors: Steve Buscemi, Viola Davis, John Cazale, Tilda Swinton',
                'Franchise deep cuts: Pick a character actor who appears across a major franchise filmography',
                'Writers: Charlie Kaufman, Diablo Cody, Aaron Sorkin, Nora Ephron',
              ].map((item) => (
                <li key={item} className="font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="why-heading" className="flex flex-col gap-4">
            <h2 id="why-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50">
              Why filmography drafts work so well
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Filmography drafts are uniquely compelling because they reward genuine film knowledge.
              Anyone can pick the famous titles — but the player who knows the deep cuts has a real edge.
              A Spielberg draft might see everyone grab <em>Schindler's List</em> and <em>Jaws</em> early,
              but who remembers <em>Duel</em> or <em>The Sugarland Express</em>?
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              This format is also naturally educational. By the end of a draft, every player has
              discovered titles they'd never considered before. It's the best kind of movie trivia game —
              one where your taste and knowledge both matter.
            </p>
          </section>

          <div
            className="flex flex-col gap-4 p-6 rounded-lg"
            style={{ background: '#160038', outline: '1px solid #3B0394', outlineOffset: '-1px' }}
          >
            <h2 className="m-0 font-brockmann font-bold text-xl text-greyscale-blue-50">
              Start your filmography draft now
            </h2>
            <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
              No account needed. Pick a filmmaker, add your friends, and start drafting in minutes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-block bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
              >
                Start a filmography draft
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
                to="/draft-by-year"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Draft by Year →
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

export default DraftByFilmography;
