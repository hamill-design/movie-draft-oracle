import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { graphJsonLd, webPageNode, siteWebAppId } from '@/components/seo/jsonLd';
import { HomeDraftSection } from '@/components/home/HomeDraftSection';

const SITE = 'https://moviedrafter.com';
const CANONICAL = `${SITE}/draft`;

const PAGE_TITLE = 'Start a Movie Draft – Set Up Your Draft | Movie Drafter';
const PAGE_DESCRIPTION =
  'Set up a movie draft in minutes: pick a filmography or year, add your friends, choose categories, and start drafting. The free movie drafting game.';

/**
 * Stripped-down setup/intro landing for the bare `/draft` URL — a focused entry point
 * (lightweight hero + the shared draft-setup form) instead of the homepage's full marketing
 * scroll. An active draft (`/draft` with location state) or `/draft/:draftId` still renders the
 * live board via `Index` (see App.tsx). Self-canonical + indexable so it earns its sitemap slot.
 */
const DraftSetup = () => {
  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={CANONICAL} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd({
              ...webPageNode({
                path: '/draft',
                name: PAGE_TITLE,
                description: PAGE_DESCRIPTION,
              }),
              mainEntity: { '@id': siteWebAppId },
            })
          )}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        {/* ── Compact hero ── */}
        <section className="w-full px-6 pt-16 pb-8 md:pt-20 md:pb-10">
          <div className="max-w-[768px] mx-auto flex flex-col items-center gap-5 text-center">
            <h1 className="m-0 font-chaney font-normal text-4xl md:text-6xl leading-tight text-greyscale-blue-100">
              Set up your draft
            </h1>
            <p className="m-0 max-w-[640px] font-brockmann font-medium text-sm md:text-lg leading-relaxed text-greyscale-blue-100">
              Pick a filmography or a year, add your friends, choose your categories, and start
              drafting. It only takes a minute.
            </p>
          </div>
        </section>

        {/* ── Draft setup form (shared with the homepage) ── */}
        <HomeDraftSection />

        <div className="h-8" />
      </div>
    </>
  );
};

export default DraftSetup;
