import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
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
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div
      className="rounded-lg overflow-hidden animate-pulse flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="w-full h-44" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-3 rounded w-20" style={{ background: 'rgba(131,122,255,0.25)' }} />
        <div className="h-4 rounded w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-4 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-3 rounded w-full mt-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="h-3 rounded w-5/6" style={{ background: 'rgba(255,255,255,0.05)' }} />
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
      className="flex flex-col overflow-hidden transition-colors duration-200 hover:[border-color:rgba(131,122,255,0.3)] hover:bg-purple-950/10"
      style={{
        background: 'rgba(13,10,30,0.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '4px',
        textDecoration: 'none',
      }}
    >
      {/* Thumbnail */}
      {item.image && (
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ height: '168px', background: 'rgba(255,255,255,0.05)' }}
        >
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLDivElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 flex-1">

        {/* Source pill — matches project's "New Feature" badge pattern */}
        {sourceName && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-900/20 font-brockmann text-[10px] font-semibold uppercase tracking-widest text-purple-300 w-fit truncate max-w-full">
            {sourceName}
          </span>
        )}

        {/* Headline */}
        <h2
          className="font-brockmann font-semibold text-[15px] leading-snug"
          style={{ color: '#FAFEFF' }}
        >
          {item.title}
        </h2>

        {/* Preview text */}
        {preview && (
          <p className="font-brockmann text-sm leading-relaxed" style={{ color: '#BBC3BF' }}>
            {preview}
          </p>
        )}

        {/* Footer row */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {date && (
            <span className="font-brockmann text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {date}
            </span>
          )}
          <ExternalLink size={13} className="shrink-0 ml-auto" style={{ color: 'rgba(131,122,255,0.5)' }} />
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
