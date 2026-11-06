import { useEffect, useState } from 'react';
import { publicPlayApi } from '@/lib/publicPlayApi';

/**
 * Is this draft a public table? (A public table has its own lobby, its own start flow, and must never
 * show players' emails.) False until proven otherwise, and false if public play isn't installed.
 */
export function useIsPublicTable(draftId?: string | null): boolean {
  const [state, setState] = useState<{ id: string; isPublic: boolean } | null>(null);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    publicPlayApi.isPublicTable(draftId).then((isPublic) => {
      if (!cancelled) setState({ id: draftId, isPublic });
    });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  return !!draftId && state?.id === draftId && state.isPublic;
}
