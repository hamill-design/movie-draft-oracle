import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type BlogPostStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status?: BlogPostStatus;
}

const COLUMNS =
  'id, slug, title, excerpt, content, cover_image_url, seo_title, seo_description, status, published_at, created_at, updated_at';

export const useBlogPostsAdmin = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBlogPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase
        .from('blog_posts' as any)
        .select(COLUMNS)
        .order('updated_at', { ascending: false }) as any);

      if (fetchError) throw fetchError;

      setPosts((data || []) as BlogPost[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch blog posts';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /** Inserts a new post with a client-generated `id` (so images can be uploaded before the first save). */
  const createBlogPost = useCallback(async (id: string, input: BlogPostInput) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Authentication error: ${authError.message}`);
      if (!user) throw new Error('You must be logged in to create blog posts');

      const status = input.status || 'draft';
      const published_at = status === 'published' ? new Date().toISOString() : null;

      const { data, error: createError } = await (supabase
        .from('blog_posts' as any)
        .insert({
          id,
          title: input.title.trim(),
          slug: input.slug,
          excerpt: input.excerpt?.trim() || null,
          content: input.content || '',
          cover_image_url: input.cover_image_url || null,
          seo_title: input.seo_title?.trim() || null,
          seo_description: input.seo_description?.trim() || null,
          status,
          published_at,
        } as any)
        .select(COLUMNS)
        .single() as any);

      if (createError) throw createError;

      const post = data as BlogPost;
      setPosts((prev) => [post, ...prev]);

      toast({
        title: 'Success',
        description: `Blog post "${post.title}" created`,
      });

      return post;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create blog post';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Updates an existing post. `currentPublishedAt` is the post's existing `published_at`
   * (pass the value from the post being edited) so that publishing for the first time
   * stamps `published_at`, while re-publishing later preserves the original date.
   */
  const updateBlogPost = useCallback(async (
    id: string,
    updates: Partial<BlogPostInput>,
    currentPublishedAt: string | null
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Authentication error: ${authError.message}`);
      if (!user) throw new Error('You must be logged in to update blog posts');

      const updateData: Record<string, unknown> = { ...updates };

      if (typeof updates.title === 'string') updateData.title = updates.title.trim();
      if (typeof updates.excerpt === 'string') updateData.excerpt = updates.excerpt.trim() || null;
      if (typeof updates.seo_title === 'string') updateData.seo_title = updates.seo_title.trim() || null;
      if (typeof updates.seo_description === 'string') updateData.seo_description = updates.seo_description.trim() || null;

      if (updates.status === 'published' && !currentPublishedAt) {
        updateData.published_at = new Date().toISOString();
      }

      const { data, error: updateError } = await (supabase
        .from('blog_posts' as any)
        .update(updateData as any)
        .eq('id', id)
        .select(COLUMNS)
        .single() as any);

      if (updateError) throw updateError;

      const post = data as BlogPost;
      setPosts((prev) => prev.map((p) => (p.id === id ? post : p)));

      toast({
        title: 'Success',
        description: 'Blog post updated',
      });

      return post;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update blog post';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteBlogPost = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Authentication error: ${authError.message}`);
      if (!user) throw new Error('You must be logged in to delete blog posts');

      const { error: deleteError } = await (supabase
        .from('blog_posts' as any)
        .delete()
        .eq('id', id) as any);

      if (deleteError) throw deleteError;

      setPosts((prev) => prev.filter((p) => p.id !== id));

      toast({
        title: 'Success',
        description: 'Blog post deleted',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete blog post';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    posts,
    loading,
    error,
    fetchBlogPosts,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
  };
};
