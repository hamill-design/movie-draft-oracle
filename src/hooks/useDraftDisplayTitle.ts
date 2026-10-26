import { useEffect, useState } from 'react';
import { resolveDraftTitle, specDraftTitleNeedsLookup } from '@/utils/resolveDraftTitle';

interface DraftTitleSource {
  title?: string | null;
  theme?: string | null;
  option?: string | null;
}

/**
 * A readable title for a draft. For spec drafts the saved title can be the spec draft's id
 * (older rows, or drafts passed along in navigation state), so look up the real name.
 * Returns the saved title (or '' for a bare id) until the lookup finishes.
 */
export function useDraftDisplayTitle(draft: DraftTitleSource | null | undefined): string {
  const title = draft?.title?.trim() ?? '';
  const theme = draft?.theme ?? null;
  const option = draft?.option ?? null;
  const needsLookup = specDraftTitleNeedsLookup(theme, option, title);

  const [resolved, setResolved] = useState<{ option: string; name: string } | null>(null);

  useEffect(() => {
    if (!needsLookup || !option) return;
    let cancelled = false;
    resolveDraftTitle('spec-draft', option, '').then((name) => {
      if (!cancelled && name) setResolved({ option, name });
    });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, option]);

  if (!needsLookup) return title;
  return resolved && resolved.option === option ? resolved.name : '';
}
