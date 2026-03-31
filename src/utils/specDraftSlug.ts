import type { SupabaseClient } from '@supabase/supabase-js';

/** Lowercase hyphenated segment safe for URL paths. */
export function slugifySpecDraftName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'draft';
}

/**
 * Returns a slug not yet used by another spec_drafts row (optionally excluding one id on update).
 */
export async function uniqueSpecDraftSlug(
  supabase: SupabaseClient,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugifySpecDraftName(name);
  let candidate = base;
  for (let n = 0; n < 1000; n += 1) {
    const { data, error } = await supabase
      .from('spec_drafts' as never)
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidParam(value: string): boolean {
  return UUID_RE.test(value);
}
