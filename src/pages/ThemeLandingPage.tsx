import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  fetchPublicSpecDraftBySlug,
  fetchPublicSpecDraftSummaries,
  posterUrl,
  themeMovieDisplayText,
  themeMovieRealText,
  type PublicSpecDraftMovie,
  type PublicSpecDraftSummary,
} from '@/services/publicSpecDrafts';

const SITE = 'https://moviedrafter.com';

function truncateMeta(text: string, max = 158): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function truncateJsonLdDescription(text: string, max = 500): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function CircleChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={`transition-transform ease-in-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
      style={{ transitionDuration: '400ms' }}
    >
      <path
        d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM15.0049 10.2754C15.3954 9.88487 16.0284 9.88487 16.4189 10.2754C16.8095 10.6659 16.8095 11.2989 16.4189 11.6895L12.707 15.4014C12.3165 15.7919 11.6835 15.7919 11.293 15.4014L7.58008 11.6895C7.1898 11.2991 7.19004 10.6659 7.58008 10.2754C7.9706 9.88487 8.60459 9.88487 8.99512 10.2754L12 13.2803L15.0049 10.2754Z"
        fill="#828786"
      />
    </svg>
  );
}

/** Descriptive alt for poster images (image search + accessibility). */
function posterAlt(movie: PublicSpecDraftMovie): string {
  return movie.movie_year != null
    ? `${movie.movie_title} (${movie.movie_year}) movie poster`
    : `${movie.movie_title} movie poster`;
}

const preloaded = new Set<string>();
/** Warm the browser cache so a lazy poster inside a collapsed row is ready before it wipes open. */
function preloadImage(src: string) {
  if (preloaded.has(src)) return;
  preloaded.add(src);
  new Image().src = src;
}

type MovieSort = 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc';

const SORT_OPTIONS: { value: MovieSort; label: string }[] = [
  { value: 'title-asc', label: 'Title (A–Z)' },
  { value: 'title-desc', label: 'Title (Z–A)' },
  { value: 'year-desc', label: 'Year (newest)' },
  { value: 'year-asc', label: 'Year (oldest)' },
];

const ThemeLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<{
    draft: PublicSpecDraftSummary;
    movies: PublicSpecDraftMovie[];
  } | null>(null);
  const [allThemes, setAllThemes] = useState<PublicSpecDraftSummary[]>([]);
  const [sortBy, setSortBy] = useState<MovieSort>('title-asc');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const summaries = await fetchPublicSpecDraftSummaries();
      if (!cancelled) setAllThemes(summaries);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Random sample of posters for the slideshow; reshuffles per page load / draft, not per render.
  const posterStrip = useMemo(() => {
    const withPosters = (payload?.movies ?? []).filter((m) => m.movie_poster_path);
    for (let i = withPosters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withPosters[i], withPosters[j]] = [withPosters[j], withPosters[i]];
    }
    return withPosters.slice(0, 24);
  }, [payload]);

  // Visible list order only; structured data above stays alphabetical.
  const displayMovies = useMemo(() => {
    if (sortBy === 'title-asc') return sortedMovies;
    const byTitle = (a: PublicSpecDraftMovie, b: PublicSpecDraftMovie) =>
      a.movie_title.localeCompare(b.movie_title, undefined, { sensitivity: 'base' });
    const list = [...sortedMovies];
    if (sortBy === 'title-desc') return list.sort((a, b) => byTitle(b, a));
    const dir = sortBy === 'year-desc' ? -1 : 1;
    // Films without a year always go last
    return list.sort((a, b) => {
      if (a.movie_year == null && b.movie_year == null) return byTitle(a, b);
      if (a.movie_year == null) return 1;
      if (b.movie_year == null) return -1;
      return (a.movie_year - b.movie_year) * dir || byTitle(a, b);
    });
  }, [sortedMovies, sortBy]);

  const itemListJson = useMemo(() => {
    if (!payload) return null;
    const url = `${SITE}/special-draft/${payload.draft.slug}`;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${payload.draft.name} — eligible films`,
      description: payload.draft.description || `Films in the ${payload.draft.name} movie drafting game pool.`,
      numberOfItems: sortedMovies.length,
      itemListElement: sortedMovies.map((m, i) => {
        const poster = posterUrl(m.movie_poster_path);
        const body = themeMovieDisplayText(m, payload.draft.name);
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `${url}#movie-${m.id}`,
          item: {
            '@type': 'Movie',
            name: m.movie_year != null ? `${m.movie_title} ${m.movie_year}` : m.movie_title,
            ...(poster ? { image: poster } : {}),
            ...(body ? { description: truncateJsonLdDescription(body) } : {}),
          },
        };
      }),
    };
  }, [payload, sortedMovies]);

  const relatedThemes = useMemo(() => {
    return allThemes.filter((t) => t.slug !== slug).slice(0, 3);
  }, [allThemes, slug]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!slug) {
    return null;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-brockmann text-base font-medium text-[#FCFFFF]"
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

  // Dedicated hero image wins; otherwise fall back to the draft's square photo
  const bannerSource = draft.hero_image_url || draft.photo_url;
  const bannerImg = bannerSource
    ? bannerSource.startsWith('http')
      ? bannerSource
      : `https://image.tmdb.org/t/p/w1280${bannerSource}`
    : null;

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Special Drafts', path: '/special-draft' },
    { name: draft.name, path: `/special-draft/${draft.slug}` },
  ];

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
        <script type="application/ld+json">
          {JSON.stringify(graphJsonLd(breadcrumbListNode(crumbs)))}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full overflow-x-clip"
        style={{
          background: 'linear-gradient(97deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        {/* Banner: draft photo behind the breadcrumbs */}
        <div className="relative isolate h-[240px] overflow-hidden sm:h-[400px]">
          {bannerImg ? (
            <img
              src={bannerImg}
              alt={`${draft.name} — special movie draft`}
              className="absolute inset-0 -z-10 h-full w-full object-cover"
              decoding="async"
            />
          ) : null}
          <Breadcrumbs items={crumbs} />
        </div>

        <div className="mx-auto flex max-w-[1872px] flex-col items-center gap-12 px-4 pb-12 pt-6 sm:px-6 sm:pt-12">
          <header className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h1 className="m-0 font-chaney text-4xl font-normal leading-none text-[#FAFEFF] sm:text-6xl">
                {draft.name}
              </h1>
              <p className="m-0 font-brockmann text-lg font-medium leading-[26px] text-[#FAFEFF]">{intro}</p>
            </div>
            <Link
              to={`/spec-draft/${draft.slug}/setup`}
              className="inline-flex shrink-0 items-center justify-center self-start rounded-[2px] bg-[#FFD60A] px-[18px] py-3 font-brockmann text-base font-semibold leading-6 tracking-[0.32px] text-[#2B2D2D] transition-colors hover:bg-[#FFE04D] sm:self-auto"
            >
              Begin Setup
            </Link>
          </header>
        </div>

          {posterStrip.length > 0 ? (
            <div
              className="poster-marquee w-full overflow-hidden motion-reduce:overflow-x-auto"
              aria-hidden
            >
              <div
                className="poster-marquee-track flex w-max motion-reduce:animate-none"
                style={{ animationDuration: `${posterStrip.length * 3}s` }}
              >
                {[0, 1].map((copy) => (
                  <ul key={copy} className="m-0 flex list-none gap-2 p-0 pr-2">
                    {posterStrip.map((movie) => (
                      <li key={movie.id} className="w-[140px] shrink-0 sm:w-[170px]">
                        <img
                          src={posterUrl(movie.movie_poster_path) as string}
                          alt={copy === 0 ? posterAlt(movie) : ''}
                          className="aspect-[2/3] w-full rounded-lg border border-[#5106C9] object-cover"
                          width={170}
                          height={255}
                          loading="lazy"
                          decoding="async"
                        />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          ) : null}

        <div className="mx-auto flex max-w-[1872px] flex-col items-center gap-12 px-4 pb-6 pt-12 sm:px-6">

          <section
            aria-labelledby="films-heading"
            className="flex w-full flex-col gap-6 rounded-lg bg-[#0E0E0F] p-4 shadow-[0_0_6px_#3B0394] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-3">
              <h2 id="films-heading" className="m-0 font-brockmann text-xl font-semibold leading-7 text-[#FAFEFF]">
                Eligible films
                {movies.length ? <span className="font-normal text-[#D6DBDB]"> ({movies.length})</span> : null}
              </h2>
              {movies.length > 1 ? (
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as MovieSort)}>
                  <SelectTrigger
                    aria-label="Sort eligible films"
                    className="h-11 w-[229px] rounded-[2px] border border-[#BDC3C2] bg-[#1D1D1F] px-4 font-brockmann text-sm font-medium text-[#BDC3C2] focus:ring-purple-400"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#49474B] bg-[#1D1D1F] font-brockmann text-[#FCFFFF]">
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="focus:bg-purple-800 focus:text-[#FCFFFF]">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            {movies.length === 0 ? (
              <p className="m-0 px-3 font-brockmann leading-relaxed text-greyscale-blue-200">
                Film data for this theme is still loading in our catalog. You can still{' '}
                <Link to={`/spec-draft/${draft.slug}/setup`} className="text-purple-300 underline">
                  open the draft setup
                </Link>{' '}
                to see the live pool inside the app.
              </p>
            ) : (
              <div className="flex flex-col gap-px overflow-hidden font-brockmann">
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {displayMovies.map((movie, i) => {
                    const img = posterUrl(movie.movie_poster_path);
                    const open = expandedIds.has(movie.id);
                    const panelId = `movie-panel-${movie.id}`;
                    const categories = movie.categories;
                    return (
                      <li key={movie.id} id={`movie-${movie.id}`} className="flex flex-col">
                        <h3 className="m-0 text-base font-normal">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => toggleExpanded(movie.id)}
                          onMouseEnter={() => img && preloadImage(img)}
                          onFocus={() => img && preloadImage(img)}
                          onTouchStart={() => img && preloadImage(img)}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_64px_44px] items-center rounded-lg text-left text-sm leading-5 text-[#FCFFFF] outline-none focus-visible:ring-2 focus-visible:ring-purple-400 sm:grid-cols-[minmax(0,1fr)_96px_44px] transition-colors duration-150 ease-out hover:bg-purple-800/60 ${i % 2 === 0 ? 'bg-[#2C2B2D]' : 'bg-[#1D1D1F]'}`}
                        >
                          <span className="px-4 py-3 font-medium">{movie.movie_title}</span>
                          <span className="px-2 py-3 text-right font-medium sm:px-4">{movie.movie_year ?? '—'}</span>
                          <span className="flex h-11 w-11 items-center justify-center">
                            <CircleChevron open={open} />
                          </span>
                        </button>
                        </h3>
                        {/* Wipe open: grid row opens top-down (content keeps its size, anchored to the top)
                            while the contents fade in. No clip-path, which flashed a white line. */}
                        <div
                          id={panelId}
                          className={`grid transition-[grid-template-rows] ease-in-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                          style={{ transitionDuration: '400ms' }}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="pt-0.5">
                            <div
                              className={`flex gap-4 rounded-lg bg-[#0E0E0F] p-4 motion-reduce:transition-none ${open ? 'opacity-100 transition-opacity duration-300 delay-150 ease-out' : 'opacity-0 transition-opacity duration-150 ease-in'}`}
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={posterAlt(movie)}
                                  className="h-[186px] w-[124px] shrink-0 rounded bg-[#1D1D1F] object-cover"
                                  width={124}
                                  height={186}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className="h-[186px] w-[124px] shrink-0 rounded bg-greyscale-purp-800" aria-hidden />
                              )}
                              <div className="flex min-w-0 flex-1 flex-col gap-4">
                                {categories.length > 0 ? (
                                  <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium leading-5 text-[#BDC3C2]">Eligible Categories</span>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold leading-4 text-[#A496FF]">
                                      {categories.map((g) => (
                                        <span key={g}>{g}</span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {themeMovieRealText(movie) ? (
                                  <p className="m-0 text-sm leading-5 text-[#FCFFFF]">{themeMovieRealText(movie)}</p>
                                ) : null}
                              </div>
                            </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {relatedThemes.length > 0 ? (
            <section aria-labelledby="related-heading" className="flex w-full flex-col gap-6 border-t border-[#4A484B] pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="related-heading" className="m-0 font-brockmann text-xl font-semibold leading-7 text-[#FAFEFF]">
                  More special drafts
                </h2>
                <Link to="/special-draft" className="font-brockmann text-sm text-[#837AFF] underline hover:text-[#A496FF]">
                  Browse all special drafts
                </Link>
              </div>
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-3">
                {relatedThemes.map((theme) => {
                  const img = posterUrl(theme.photo_url);
                  return (
                    <li
                      key={theme.id}
                      className="flex min-w-0 flex-col gap-4 rounded-md border border-[#49474B] bg-[#0E0E0F] p-[18px] sm:flex-row"
                    >
                      <div className="aspect-[273/240] w-full overflow-hidden rounded-[3px] bg-greyscale-purp-800 sm:w-1/2 sm:flex-1">
                        {img ? (
                          <img
                            src={img}
                            alt={`${theme.name} — special movie draft`}
                            className="h-full w-full object-cover"
                            width={273}
                            height={240}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
                        <div className="flex flex-col gap-2">
                          <h3 className="m-0 font-brockmann text-2xl font-semibold leading-[30px] tracking-[0.48px] text-[#FCFFFF]">
                            {theme.name}
                          </h3>
                          {theme.description ? (
                            <p className="m-0 line-clamp-3 font-brockmann text-sm leading-5 text-[#FCFFFF]">
                              {theme.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-3">
                          <Link
                            to={`/special-draft/${theme.slug}`}
                            className="flex h-9 items-center justify-center rounded-[2px] bg-[#1D1D1F] px-3 font-brockmann text-sm font-medium text-[#FCFFFF] transition-colors hover:bg-[#2C2B2D]"
                          >
                            View Eligible Films
                          </Link>
                          <Link
                            to={`/spec-draft/${theme.slug}/setup`}
                            className="flex h-9 items-center justify-center rounded-[2px] bg-[#7142FF] px-3 font-brockmann text-sm font-medium text-[#FCFFFF] transition-colors hover:bg-[#8160FF]"
                          >
                            Begin Setup
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <footer className="w-full border-t border-[#4A484B] pt-8">
            <p className="m-0 font-brockmann text-sm leading-[22.75px] text-[#BBC3BF]">
              Data powered by{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#837AFF] underline hover:text-[#A496FF]"
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
