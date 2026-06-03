import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { formatDistanceToNow } from 'date-fns';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { breadcrumbListNode, graphJsonLd, webPageNode } from '@/components/seo/jsonLd';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  image: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    // Numeric decimal entities: &#8216; &#8217; &#8212; etc.
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Numeric hex entities: &#x2019; etc.
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Common named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”');
}

function stripHtml(html: string): string {
  return decodeEntities(
    html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  );
}

function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true }).replace(/^about /, '');
  } catch {
    return '';
  }
}

// ── Icon ──────────────────────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="8.13" y="1.63" width="3.25" height="3.25" stroke="#7142FF" strokeWidth="1.08" />
      <rect x="5.42" y="1.63" width="5.96" height="5.96" stroke="#7142FF" strokeWidth="1.08" />
      <rect x="1.63" y="3.25" width="8.13" height="8.13" stroke="#7142FF" strokeWidth="1.08" />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div
      className="animate-pulse flex flex-col overflow-hidden"
      style={{ background: '#0E0E0F', borderRadius: '4px', outline: '1px solid #49474B', outlineOffset: '-1px' }}
    >
      <div style={{ height: '168px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
      <div className="flex flex-col justify-between flex-1 gap-4" style={{ padding: '16px' }}>
        <div className="flex flex-col gap-2">
          <div className="rounded h-5 w-4/5" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="rounded h-5 w-3/5" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="rounded h-4 w-full mt-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="rounded h-4 w-11/12" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="rounded h-4 w-4/5" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="rounded-full h-6 w-24" style={{ background: 'rgba(41,34,0,0.8)' }} />
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const preview = (() => {
    const plain = stripHtml(item.description);
    return plain.length > 180 ? plain.slice(0, 180) + '…' : plain;
  })();
  const date = relativeDate(item.pubDate);
  const sourceName = item.source
    ? item.source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    : '';

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        width: '100%',
        background: '#0E0E0F',
        overflow: 'hidden',
        borderRadius: '4px',
        outline: '1px solid #49474B',
        outlineOffset: '-1px',
        textDecoration: 'none',
        transition: 'outline-color 200ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.outlineColor = '#7142FF';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.outlineColor = '#49474B';
      }}
    >
      {/* Thumbnail — only rendered when an image exists */}
      {item.image && (
        <div style={{ alignSelf: 'stretch', height: '168px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={item.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLDivElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Body */}
      <div style={{ alignSelf: 'stretch', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '16px' }}>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ margin: 0, color: '#FCFFFF', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px', wordWrap: 'break-word' }}>
            {decodeEntities(item.title)}
          </h2>
          {preview && (
            <p style={{ margin: 0, color: '#BDC3C2', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px' }}>
              {preview}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {sourceName && (
              <span style={{
                padding: '4px 12px',
                background: '#292200',
                borderRadius: '9999px',
                color: '#FFE97A',
                fontSize: '12px',
                fontFamily: 'Brockmann',
                fontWeight: 600,
                textTransform: 'uppercase',
                lineHeight: '16px',
                letterSpacing: '0.96px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '160px',
                flexShrink: 0,
              }}>
                {sourceName}
              </span>
            )}
            {date && (
              <span style={{ color: '#BDC3C2', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', letterSpacing: '0.36px', whiteSpace: 'nowrap' }}>
                {date}
              </span>
            )}
          </div>
          <ExternalLinkIcon />
        </div>
      </div>
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const News = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news-feed'],
    queryFn: async () => {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ items: NewsItem[] }>;
    },
    staleTime: 15 * 60 * 1000, // match server cache
    retry: 2,
  });

  const items = data?.items ?? [];

  return (
    <>
      <Helmet>
        <title>Film News – Movie Drafter</title>
        <meta
          name="description"
          content="The latest film news, box office updates, and cinema stories — curated for Movie Drafter."
        />
        <link rel="canonical" href="https://moviedrafter.com/news" />
        <meta property="og:title" content="Film News – Movie Drafter" />
        <meta
          property="og:description"
          content="The latest film news, box office updates, and cinema stories — curated for Movie Drafter."
        />
        <meta property="og:url" content="https://moviedrafter.com/news" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Film News – Movie Drafter" />
        <meta
          name="twitter:description"
          content="The latest film news, box office updates, and cinema stories — curated for Movie Drafter."
        />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/news',
                name: 'Film News – Movie Drafter',
                description:
                  'The latest film news, box office updates, and cinema stories — curated for Movie Drafter.',
              }),
              breadcrumbListNode([
                { name: 'Home', path: '/' },
                { name: 'News', path: '/news' },
              ])
            )
          )}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-12 flex flex-col gap-10">

          {/* Header */}
          <div className="flex flex-col gap-3">
            <h1
              className="font-chaney font-normal text-4xl md:text-[48px] leading-tight"
              style={{ color: '#FAFEFF' }}
            >
              Film News
            </h1>
            <p
              className="font-brockmann text-base max-w-xl"
              style={{ color: '#BBC3BF' }}
            >
              The latest stories from the world of cinema.
            </p>
          </div>

          {/* Error state */}
          {isError && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="font-brockmann text-sm" style={{ color: '#BBC3BF' }}>
                Couldn't load the feed right now.
              </p>
              <button
                onClick={() => refetch()}
                className="font-brockmann text-sm font-medium px-4 py-2 rounded-sm transition-colors"
                style={{
                  color: '#BCB2FF',
                  border: '1px solid rgba(188,178,255,0.4)',
                  background: 'transparent',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Grid */}
          {!isError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {isLoading
                ? Array.from({ length: 9 }).map((_, i) => (
                    <NewsCardSkeleton key={i} />
                  ))
                : items.map((item, i) => <NewsCard key={i} item={item} />)}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && items.length === 0 && (
            <p
              className="font-brockmann text-sm text-center py-16"
              style={{ color: '#BBC3BF' }}
            >
              No stories available right now. Check back soon.
            </p>
          )}

        </div>
      </div>
    </>
  );
};

export default News;
