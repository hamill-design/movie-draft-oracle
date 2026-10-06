import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { articleNode, breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DEFAULT_OG_IMAGE_URL, SITE_ORIGIN } from '@/config/socialShareMeta';
import { fetchPublishedBlogPostBySlug, blogPostPreview } from '@/services/publicBlog';
import leagueTrophyIllustration from '@/assets/illustrations/illus/league-trophy.svg';

type RelatedLink = { title: string; description: string; href: string; cta: string; image: string; imageAlt: string };

const RELATED_LINKS_BY_SLUG: Record<string, RelatedLink[]> = {
  'updates-june-2026': [
    {
      title: 'Play with your group all season',
      description:
        'Leagues turn one-off drafts into a running rivalry — same friends, standings that carry over every time you play.',
      href: '/league',
      cta: 'Explore Leagues',
      image: leagueTrophyIllustration,
      imageAlt: 'Movie Drafter league trophy',
    },
  ],
  'spider-man-franchise-review': [
    {
      title: 'Draft every MCU film',
      description:
        'Take the web-slinger talk further with a curated pool of every Marvel Cinematic Universe release.',
      href: '/special-draft/mcu',
      cta: 'Start an MCU draft',
      image:
        'https://zduruulowyopdstihfwk.supabase.co/storage/v1/object/public/spec-draft-photos/c2fd3a3e-77d8-4108-bf77-1797392c71b6/c2fd3a3e-77d8-4108-bf77-1797392c71b6-1765235969904.jpg',
      imageAlt: 'MCU special draft',
    },
  ],
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => fetchPublishedBlogPostBySlug(slug as string),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  if (!slug) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-brockmann text-greyscale-blue-100"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        Loading post…
      </div>
    );
  }

  if (!post) {
    return (
      <>
        <Helmet>
          <title>Movie Drafter - Post not found</title>
          <meta name="robots" content="noindex, nofollow" />
          <link rel="canonical" href={`${SITE_ORIGIN}/blog`} />
        </Helmet>
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
          style={{
            background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
          }}
        >
          <h1 className="m-0 font-chaney text-2xl text-greyscale-blue-50 text-center">Post not found</h1>
          <p className="m-0 text-greyscale-blue-200 font-brockmann text-center max-w-md">
            This post may have been unpublished or the link is outdated.
          </p>
          <Button asChild className="bg-brand-primary font-brockmann">
            <Link to="/blog">Browse all posts</Link>
          </Button>
        </div>
      </>
    );
  }

  const canonical = `${SITE_ORIGIN}/blog/${post.slug}`;
  const pageTitle = `${post.seo_title || post.title} – Movie Drafter`;
  const pageDescription = post.seo_description || blogPostPreview(post);
  const dateLabel = post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : '';
  const sanitizedContent = DOMPurify.sanitize(post.content);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  const relatedLinks = RELATED_LINKS_BY_SLUG[post.slug] ?? [];

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonical} />
        {socialShareImageMetaNodes({ imageUrl: post.cover_image_url || DEFAULT_OG_IMAGE_URL })}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta property="article:published_time" content={post.published_at || post.created_at} />
        <meta property="article:modified_time" content={post.updated_at} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              articleNode({
                path: `/blog/${post.slug}`,
                headline: post.title,
                description: pageDescription,
                image: post.cover_image_url ?? undefined,
                datePublished: post.published_at ?? undefined,
                dateModified: post.updated_at,
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
        <Breadcrumbs items={crumbs} />
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-8">
          <header className="flex flex-col gap-4">
            {post.cover_image_url && (
              <figure className="m-0">
                <img
                  src={post.cover_image_url}
                  alt={post.cover_image_alt || post.title}
                  fetchpriority="high"
                  className="w-full max-h-[420px] object-cover rounded-md"
                />
                {post.cover_image_caption && (
                  <figcaption className="mt-2 text-center font-brockmann text-sm text-greyscale-blue-300">
                    {post.cover_image_caption}
                  </figcaption>
                )}
              </figure>
            )}
            <h1 className="m-0 font-chaney font-normal text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              {post.title}
            </h1>
            {dateLabel && <span className="font-brockmann text-sm text-greyscale-blue-300">{dateLabel}</span>}
          </header>

          <div
            className="prose prose-invert max-w-none prose-headings:font-chaney prose-headings:font-normal prose-headings:text-greyscale-blue-100 prose-p:font-brockmann prose-li:font-brockmann prose-p:text-greyscale-blue-100 prose-li:text-greyscale-blue-100 prose-strong:text-greyscale-blue-100 prose-a:text-purple-300 prose-blockquote:text-greyscale-blue-200 prose-blockquote:border-l-purple-300 prose-figcaption:text-greyscale-blue-300 prose-figcaption:text-center prose-figcaption:font-brockmann"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />

          {relatedLinks.length > 0 && (
            <section aria-label="Keep exploring" className="flex flex-col gap-4">
              <h2 className="m-0 font-brockmann font-semibold text-lg text-greyscale-blue-50">Keep exploring</h2>
              <div className="flex flex-col gap-4">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="group flex items-center gap-4 rounded-lg border border-greyscale-purp-700 bg-greyscale-purp-900/50 p-4 transition-colors hover:border-purple-400 hover:bg-greyscale-purp-850 sm:gap-6 sm:p-5"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-greyscale-purp-850 sm:h-28 sm:w-28">
                      <img
                        src={link.image}
                        alt={link.imageAlt}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="m-0 font-brockmann font-medium text-greyscale-blue-50 sm:text-lg">{link.title}</p>
                      <p className="m-0 font-brockmann text-sm text-greyscale-blue-200 line-clamp-2">
                        {link.description}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 font-brockmann text-sm font-semibold text-purple-300 transition-colors group-hover:text-purple-200">
                        {link.cta}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </>
  );
};

export default BlogPost;
