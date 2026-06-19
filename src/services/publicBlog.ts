import { supabase } from '@/integrations/supabase/client';

export type PublicBlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  published_at: string | null;
  updated_at: string;
};

export type PublicBlogPost = PublicBlogPostSummary & {
  cover_image_caption: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
};

const SUMMARY_COLUMNS =
  'id, slug, title, excerpt, content, cover_image_url, cover_image_alt, published_at, updated_at';

const FULL_COLUMNS = `${SUMMARY_COLUMNS}, cover_image_caption, seo_title, seo_description, created_at`;

/** Strips HTML tags and collapses whitespace, for deriving previews/meta descriptions. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const safe = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trim()}…`;
}

/** Card/meta preview text: curated excerpt wins, otherwise derived from the post content. */
export function blogPostPreview(post: { excerpt: string | null; content: string }, max = 180): string {
  const excerpt = post.excerpt?.trim();
  if (excerpt) return truncate(excerpt, max);
  return truncate(stripHtml(post.content), max);
}

/** All published posts, newest first. */
export async function fetchPublishedBlogPosts(): Promise<PublicBlogPostSummary[]> {
  const queryResult = await supabase
    .from('blog_posts' as never)
    .select(SUMMARY_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const { data, error } = queryResult as {
    data: PublicBlogPostSummary[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    console.error('fetchPublishedBlogPosts:', error);
    return [];
  }

  return data || [];
}

/** A single published post by slug, or null if not found/unpublished. */
export async function fetchPublishedBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const queryResult = await supabase
    .from('blog_posts' as never)
    .select(FULL_COLUMNS)
    .eq('slug', trimmed)
    .eq('status', 'published')
    .maybeSingle();

  const { data, error } = queryResult as {
    data: PublicBlogPost | null;
    error: { message?: string } | null;
  };

  if (error || !data) {
    if (error) console.error('fetchPublishedBlogPostBySlug:', error);
    return null;
  }

  return data;
}
