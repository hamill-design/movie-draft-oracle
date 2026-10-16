import { supabase } from '@/integrations/supabase/client';

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
  return fallbackTitle;
}
