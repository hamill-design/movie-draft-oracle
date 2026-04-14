import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import {
  fetchPublicSpecDraftBySlug,
  posterUrl,
  type PublicSpecDraftMovie,
  type PublicSpecDraftSummary,
} from '@/services/publicSpecDrafts';

const SITE = 'https://moviedrafter.com';

function truncateMeta(text: string, max = 158): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

const ThemeLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<{
    draft: PublicSpecDraftSummary;
    movies: PublicSpecDraftMovie[];
  } | null>(null);

  useEffect(() => {
    if (!slug) {
      setPayload(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = await fetchPublicSpecDraftBySlug(slug);
      if (!cancelled) {
        setPayload(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const sortedMovies = useMemo(() => {
    if (!payload?.movies.length) return [];
    return [...payload.movies].sort((a, b) =>
      a.movie_title.localeCompare(b.movie_title, undefined, { sensitivity: 'base' })
    );
  }, [payload]);

  const itemListJson = useMemo(() => {
    if (!payload) return null;
    const url = `${SITE}/special-draft/${payload.draft.slug}`;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${payload.draft.name} — eligible films`,
      description: payload.draft.description || `Films in the ${payload.draft.name} movie drafting game pool.`,
      numberOfItems: sortedMovies.length,
      itemListElement: sortedMovies.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${url}#movie-${m.id}`,
        item: {
          '@type': 'Movie',
          name: m.movie_year != null ? `${m.movie_title} ${m.movie_year}` : m.movie_title,
        },
      })),
    };
  }, [payload, sortedMovies]);

  if (!slug) {
    return null;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-brockmann text-greyscale-blue-100"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        Loading theme…
      </div>
    );
  }

  if (!payload) {
    return (
      <>
        <Helmet>
          <title>Movie Drafter - Theme not found</title>
          <meta name="robots" content="noindex, nofollow" />
          <link rel="canonical" href={`${SITE}/special-draft`} />
        </Helmet>
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <h1 className="m-0 font-chaney text-2xl text-greyscale-blue-50 text-center">Theme not found</h1>
        <p className="m-0 text-greyscale-blue-200 font-brockmann text-center max-w-md">
          This theme may be hidden or the link is outdated.
        </p>
        <Button asChild className="bg-brand-primary font-brockmann">
          <Link to="/special-draft">Browse all special drafts</Link>
        </Button>
      </div>
      </>
    );
  }

  const { draft, movies } = payload;
  const canonical = `${SITE}/special-draft/${draft.slug}`;
  const intro =
    draft.description?.trim() ||
    `Explore standout picks from the “${draft.name}” pool on Movie Drafter—a movie drafting game where you build rosters from curated cinema lists.`;
  const pageDesc = truncateMeta(`${intro} Full eligible film list, alphabetically.`, 158);
  const pageTitle = `Movie Drafter - ${draft.name} | Eligible films`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        {itemListJson ? (
          <script type="application/ld+json">{JSON.stringify(itemListJson)}</script>
        ) : null}
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-10">
          <nav aria-label="Back to special drafts">
            <Button
              asChild
              variant="ghost"
              className="font-brockmann text-greyscale-blue-200 hover:text-greyscale-blue-50 hover:bg-greyscale-purp-800/80 -ml-2 px-2"
            >
              <Link to="/special-draft" className="inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
                Back to special drafts
              </Link>
            </Button>
          </nav>

          <header className="flex flex-col gap-4">
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              {draft.name}
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              {intro}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 font-brockmann">
                <Link to={`/spec-draft/${draft.slug}/setup`}>Start this movie drafting game</Link>
              </Button>
            </div>
          </header>

          <section aria-labelledby="films-heading">
            <h2 id="films-heading" className="m-0 font-brockmann font-semibold text-xl text-greyscale-blue-50 mb-6">
              Eligible films
              {movies.length ? (
                <span className="font-normal text-greyscale-blue-200"> ({movies.length})</span>
              ) : null}
            </h2>
            {movies.length === 0 ? (
              <p className="text-greyscale-blue-200 font-brockmann leading-relaxed m-0">
                Film data for this theme is still loading in our catalog. You can still{' '}
                <Link to={`/spec-draft/${draft.slug}/setup`} className="text-purple-300 underline">
                  open the draft setup
                </Link>{' '}
                to see the live pool inside the app.
              </p>
            ) : (
              <ul className="list-none m-0 p-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8">
                {sortedMovies.map((movie) => {
                  const img = posterUrl(movie.movie_poster_path);
                  const titleId = `movie-title-${movie.id}`;
                  return (
                    <li key={movie.id} id={`movie-${movie.id}`} className="min-w-0">
                      <article
                        tabIndex={0}
                        aria-labelledby={titleId}
                        className="group relative h-full overflow-hidden rounded-md border border-purple-500/90 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#100029]"
                      >
                        <div className="relative aspect-[2/3] w-full overflow-hidden bg-greyscale-purp-800">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.045] group-focus-within:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-within:scale-100"
                              width={200}
                              height={300}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="h-full w-full bg-greyscale-purp-800" aria-hidden />
                          )}
                          {/* Title stays in DOM; overlay always visible below md, hover/focus on md+ */}
                          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end opacity-100 md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100 md:group-focus-within:opacity-100 motion-reduce:md:transition-none">
                            {/* Light wash over poster */}
                            <div
                              className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                              aria-hidden
                            />
                            {/* Strong band under text — readable on bright / busy posters */}
                            <div
                              className="absolute inset-x-0 bottom-0 h-[min(46%,8.25rem)] bg-gradient-to-t from-black via-black/92 to-transparent sm:h-[min(44%,7.75rem)]"
                              aria-hidden
                            />
                            <h3
                              id={titleId}
                              className="relative z-[1] m-0 px-2 pb-2.5 pt-7 text-center font-brockmann text-[11px] leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_2px_16px_rgba(0,0,0,0.85)] sm:text-xs md:text-sm"
                            >
                              <span className="font-semibold">{movie.movie_title}</span>
                              {movie.movie_year != null ? (
                                <>
                                  {' '}
                                  <span className="font-light text-purple-200">{movie.movie_year}</span>
                                </>
                              ) : null}
                            </h3>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="border-t border-greyscale-purp-700 pt-8">
            <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann leading-relaxed">
              Data powered by{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 underline hover:text-purple-200"
              >
                TMDB
              </a>
              . This page is a static-friendly overview; roster rules and scoring use your chosen categories
              inside the app.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default ThemeLandingPage;
