import type { SupabaseClient } from '@supabase/supabase-js';

/** Lowercase hyphenated segment safe for URL paths. */
export function slugifyBlogTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'post';
}

/**
 * Returns a slug not yet used by another blog_posts row (optionally excluding one id on update).
 */
export async function uniqueBlogSlug(
  supabase: SupabaseClient,
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugifyBlogTitle(title);
  let candidate = base;
  for (let n = 0; n < 1000; n += 1) {
    const { data, error } = await supabase
      .from('blog_posts' as never)
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      const msg = error.message || '';
      if (msg.includes('column') || msg.includes('does not exist')) {
        return base;
      }
      throw error;
    }

    const row = data as { id: string } | null;
    if (!row || (excludeId && row.id === excludeId)) {
      return candidate;
    }
    candidate = `${base}-${n + 1}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
