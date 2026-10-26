import { supabase } from '@/integrations/supabase/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value.trim());

/** True when a spec draft's stored title is missing or is just the spec draft's id (so it needs a name lookup). */
export function specDraftTitleNeedsLookup(
  theme: string | null | undefined,
  option: string | null | undefined,
  title: string | null | undefined
): boolean {
  if (theme !== 'spec-draft' || !option) return false;
  const t = (title ?? '').trim();
  return !t || t === option || isUuid(t);
}

/**
 * The title stored on a `drafts` row. For most themes the "option" (a year, an actor name, ...)
 * reads fine as a title, but for spec drafts the option is the spec draft's UUID — so look up
 * its real name instead of saving the id as the title.
 */
export async function resolveDraftTitle(
  theme: string,
  option: string,
  fallbackTitle: string = option
): Promise<string> {
  if (theme !== 'spec-draft' || !option) return fallbackTitle;

  try {
    const { data, error } = await (supabase as any)
      .from('spec_drafts')
      .select('name')
      .eq('id', option)
      .maybeSingle();

    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!error && name) return name;
  } catch (err) {
    console.warn('resolveDraftTitle: spec draft name lookup failed', err);
  }
  // Never hand back a bare id as the title
  return isUuid(fallbackTitle) ? 'Special Draft' : fallbackTitle;
}
