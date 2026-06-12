import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { articleNode, breadcrumbListNode, graphJsonLd } from '@/components/seo/jsonLd';
import { DEFAULT_OG_IMAGE_URL, SITE_ORIGIN } from '@/config/socialShareMeta';
import { fetchPublishedBlogPostBySlug, blogPostPreview } from '@/services/publicBlog';

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
              breadcrumbListNode([
                { name: 'Home', path: '/' },
                { name: 'Blog', path: '/blog' },
                { name: post.title, path: `/blog/${post.slug}` },
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
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-8">
          <nav aria-label="Back to blog">
            <Button
              asChild
              variant="ghost"
              className="font-brockmann text-greyscale-blue-200 hover:text-greyscale-blue-50 hover:bg-greyscale-purp-800/80 -ml-2 px-2"
            >
              <Link to="/blog" className="inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
                Back to blog
              </Link>
            </Button>
          </nav>

          <header className="flex flex-col gap-4">
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt=""
                className="w-full max-h-[420px] object-cover rounded-md"
              />
            )}
            <h1 className="m-0 font-chaney font-normal text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              {post.title}
            </h1>
            {dateLabel && <span className="font-brockmann text-sm text-greyscale-blue-300">{dateLabel}</span>}
          </header>

          <div
            className="prose prose-invert max-w-none prose-headings:font-chaney prose-headings:font-normal prose-headings:text-greyscale-blue-100 prose-p:font-brockmann prose-li:font-brockmann prose-p:text-greyscale-blue-100 prose-li:text-greyscale-blue-100 prose-strong:text-greyscale-blue-100 prose-a:text-purple-300 prose-blockquote:text-greyscale-blue-200 prose-blockquote:border-l-purple-300"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        </article>
      </div>
    </>
  );
};

export default BlogPost;
