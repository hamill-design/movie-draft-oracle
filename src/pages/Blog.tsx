import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { breadcrumbListNode, graphJsonLd, webPageNode } from '@/components/seo/jsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  fetchPublishedBlogPosts,
  blogPostPreview,
  type PublicBlogPostSummary,
} from '@/services/publicBlog';

const PAGE_DESCRIPTION =
  'Tips, strategy guides, and updates from Movie Drafter — the movie drafting game for friends.';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BlogCardSkeleton() {
  return (
    <div
      className="animate-pulse flex flex-col overflow-hidden"
      style={{ background: '#0E0E0F', borderRadius: '4px', outline: '1px solid #49474B', outlineOffset: '-1px' }}
    >
      <div style={{ height: '168px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
      <div className="flex flex-col justify-between flex-1 gap-4" style={{ padding: '16px' }}>
        <div className="flex flex-col gap-2">
          <div className="rounded h-5 w-4/5" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="rounded h-4 w-full mt-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="rounded h-4 w-11/12" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="rounded h-4 w-24" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function BlogCard({ post }: { post: PublicBlogPostSummary }) {
  const preview = blogPostPreview(post);
  const dateLabel = post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : '';

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="flex flex-col w-full overflow-hidden rounded-[4px] bg-[#0E0E0F] outline outline-1 -outline-offset-1 outline-[#49474B] transition-colors hover:outline-[#7142FF] hover:bg-[#1C1A1E]"
    >
      {post.cover_image_url && (
        <div style={{ height: '168px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <h2 style={{ margin: 0, color: '#FCFFFF', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px' }}>
          {post.title}
        </h2>
        {preview && (
          <p style={{ margin: 0, color: '#BDC3C2', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '22px' }}>
            {preview}
          </p>
        )}
        {dateLabel && (
          <span style={{ color: '#BDC3C2', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px', letterSpacing: '0.36px' }}>
            {dateLabel}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Blog = () => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: fetchPublishedBlogPosts,
    staleTime: 5 * 60 * 1000,
  });

  const items = posts ?? [];

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
  ];

  return (
    <>
      <Helmet>
        <title>Blog – Movie Drafter</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href="https://moviedrafter.com/blog" />
        <meta property="og:title" content="Blog – Movie Drafter" />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content="https://moviedrafter.com/blog" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Blog – Movie Drafter" />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/blog',
                name: 'Blog – Movie Drafter',
                description: PAGE_DESCRIPTION,
              }),
              breadcrumbListNode(crumbs)
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
          <Breadcrumbs items={crumbs} />

          {/* Header */}
          <div className="flex flex-col gap-3">
            <h1
              className="font-chaney font-normal text-4xl md:text-[48px] leading-tight"
              style={{ color: '#FAFEFF' }}
            >
              Blog
            </h1>
            <p
              className="font-brockmann text-base w-full"
              style={{ color: '#BBC3BF' }}
            >
              {PAGE_DESCRIPTION}
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <BlogCardSkeleton key={i} />)
              : items.map((post) => <BlogCard key={post.id} post={post} />)}
          </div>

          {/* Empty state */}
          {!isLoading && items.length === 0 && (
            <p
              className="font-brockmann text-sm text-center py-16"
              style={{ color: '#BBC3BF' }}
            >
              No posts yet. Check back soon.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default Blog;
