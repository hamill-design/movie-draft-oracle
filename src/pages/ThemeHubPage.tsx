import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Film } from 'lucide-react';
import {
  fetchPublicSpecDraftSummaries,
  posterUrl,
  type PublicSpecDraftSummary,
} from '@/services/publicSpecDrafts';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';

const SITE = 'https://moviedrafter.com';

const INTRO_COPY =
  'Looking for a new theme to your movie game night? Each special draft has a curated pool of eligible films (listed alphabetically). Browse titles or begin setting up your draft here.';

const ThemeHubPage = () => {
  const [drafts, setDrafts] = useState<PublicSpecDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchPublicSpecDraftSummaries();
      if (!cancelled) {
        setDrafts(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pageTitle = 'Movie Drafter - Special drafts & eligible film lists';
  const pageDesc =
    'Browse public special drafts and see which films are in each pool, or start a fantasy movie draft on Movie Drafter.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/special-draft`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/special-draft`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
      </Helmet>

      <div
        className="min-h-screen w-full flex flex-col items-center px-6"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <div className="w-full max-w-[1200px] py-8 flex flex-col items-start gap-8">
          <header className="flex w-full flex-col items-start gap-[18px]">
            <h1 className="m-0 w-full font-chaney text-[48px] font-normal leading-[52px] tracking-[1.92px] text-[#FCFFFF]">
              Special Drafts
            </h1>
            <p className="m-0 w-full max-w-full font-brockmann text-[18px] font-medium leading-[26px] text-[#FCFFFF]">
              {INTRO_COPY}
            </p>
          </header>

          {loading ? (
            <p className="w-full text-center font-brockmann text-greyscale-blue-200 py-12">
              Loading special drafts…
            </p>
          ) : drafts.length === 0 ? (
            <p className="w-full text-center font-brockmann text-greyscale-blue-200 py-12">
              No public special drafts yet.{' '}
              <Link to="/" className="text-purple-300 underline hover:text-purple-200">
                Start a draft from the home page
              </Link>
              .
            </p>
          ) : (
            <ul className="m-0 grid w-full grid-cols-1 list-none gap-6 p-0 md:grid-cols-2 md:gap-6 lg:gap-8">
              {drafts.map((draft) => {
                const img = posterUrl(draft.photo_url);
                const slug = draft.slug;
                return (
                  <li key={draft.id} className="min-w-0">
                    <article
                      className={[
                        'flex w-full min-w-0 rounded-md border border-[#49474B] bg-[#0E0E0F] p-[18px]',
                        // <466: wrapped compact row
                        'max-[465px]:flex-wrap max-[465px]:content-center max-[465px]:items-center max-[465px]:gap-4',
                        // 466–767: single-column grid, long horizontal card (image | copy + buttons)
                        'min-[466px]:max-md:flex-row min-[466px]:max-md:flex-nowrap min-[466px]:max-md:items-stretch min-[466px]:max-md:gap-4 min-[466px]:max-md:min-h-[218px]',
                        // 768–1023: two-column grid, tall stacked card
                        'md:flex-col md:flex-nowrap md:items-stretch md:content-start md:gap-6',
                        // 1024+: two-column grid, long-list row
                        'lg:h-[276px] lg:min-h-[218px] lg:flex-row lg:items-stretch lg:content-stretch lg:gap-4',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'relative overflow-hidden rounded-[3px] bg-[#1a1a1c]',
                          'max-[465px]:min-h-[182px] max-[465px]:h-[182px] max-[465px]:min-w-[182px] max-[465px]:flex-[1_1_0]',
                          // Long row (466–767): fixed share of row so image + text stay even
                          'min-[466px]:max-md:h-auto min-[466px]:max-md:min-h-[182px] min-[466px]:max-md:w-[42%] min-[466px]:max-md:max-w-[min(268px,46vw)] min-[466px]:max-md:flex-none min-[466px]:max-md:self-stretch min-[466px]:max-md:shrink-0',
                          'md:h-[182px] md:min-h-[182px] md:w-full md:min-w-0 md:flex-none md:max-w-none',
                          'lg:h-auto lg:min-h-0 lg:w-auto lg:min-w-[182px] lg:max-w-none lg:flex-1 lg:self-stretch',
                        ].join(' ')}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={draft.name}
                            className="h-full w-full object-cover"
                            width={268}
                            height={240}
                          />
                        ) : (
                          <div className="flex h-full w-full min-h-[182px] items-center justify-center lg:min-h-0">
                            <Film className="h-10 w-10 text-greyscale-blue-500" aria-hidden />
                          </div>
                        )}
                      </div>

                      <div
                        className={[
                          'flex min-w-0 flex-1 flex-col items-stretch gap-6 self-stretch',
                          'max-[465px]:min-w-[182px] max-[465px]:basis-[min(100%,20rem)]',
                          'min-[466px]:max-md:min-h-0 min-[466px]:max-md:justify-between min-[466px]:max-md:gap-0',
                          'md:w-full md:justify-start md:gap-6',
                          'lg:min-h-0 lg:w-auto lg:justify-between lg:gap-0',
                        ].join(' ')}
                      >
                        <div className="flex w-full min-w-0 flex-col items-start gap-2">
                          <h2 className="m-0 w-full font-brockmann text-2xl font-semibold leading-[30px] tracking-[0.48px] text-[#FCFFFF]">
                            <Link
                              to={`/special-draft/${slug}`}
                              className="transition-opacity hover:opacity-90"
                            >
                              {draft.name}
                            </Link>
                          </h2>
                          {draft.description ? (
                            <p className="m-0 w-full font-brockmann text-sm font-normal leading-5 text-[#FCFFFF]">
                              {draft.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex w-full min-w-0 flex-col items-stretch gap-3">
                          <Link
                            to={`/special-draft/${slug}`}
                            className="inline-flex h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-[2px] bg-[#1D1D1F] px-4 py-2 text-center font-brockmann text-sm font-medium leading-5 text-[#FCFFFF] transition-colors duration-150 hover:bg-[#2e2e33] active:bg-[#18181a]"
                          >
                            View Eligible Films
                          </Link>
                          <Link
                            to={`/spec-draft/${slug}/setup`}
                            className="inline-flex h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-[2px] bg-[#7142FF] px-4 py-2 text-center font-brockmann text-sm font-medium leading-5 text-[#FCFFFF] transition-opacity hover:opacity-90"
                          >
                            Begin Setup
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default ThemeHubPage;
