import { useEffect, useState } from 'react';
import { publicPlayApi } from '@/lib/publicPlayApi';

export type TableKind = 'unknown' | 'public' | 'private';

// A draft never changes from private to public (or back), so once we know, we know. A screen opened a second time,
// a second component on the same screen, and the draft loader all share one answer and one lookup.
const known = new Map<string, boolean>();
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Asks (once per draft) whether this is a public table. Only a real answer is remembered: if the lookup fails
 * (public play isn't installed, or a blip) the answer is "private" this time but it is asked again next time,
 * so a hiccup can never leave a public table treated as private for the rest of the session.
 */
export function lookupIsPublicTable(draftId: string): Promise<boolean> {
  if (known.has(draftId)) return Promise.resolve(known.get(draftId) === true);
  let pending = inFlight.get(draftId);
  if (!pending) {
    pending = publicPlayApi
      .isPublicTableStrict(draftId)
      .then((isPublic) => {
        known.set(draftId, isPublic);
        return isPublic;
      })
      .catch(() => false)
      .finally(() => {
        inFlight.delete(draftId);
      });
    inFlight.set(draftId, pending);
  }
  return pending;
}

/**
 * Is this draft a public table? A public table has its own lobby and start flow, and must never show players'
 * emails. Starts as 'unknown' so a screen can wait for the answer instead of drawing the wrong lobby first and
 * swapping it a moment later; it is 'private' if public play isn't installed.
 */
export function useTableKind(draftId?: string | null): TableKind {
  const [state, setState] = useState<{ id: string; isPublic: boolean } | null>(() =>
    draftId && known.has(draftId) ? { id: draftId, isPublic: known.get(draftId) === true } : null
  );

  useEffect(() => {
    if (!draftId || known.has(draftId)) return;
    let cancelled = false;
    lookupIsPublicTable(draftId).then((isPublic) => {
      if (!cancelled) setState({ id: draftId, isPublic });
    });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  if (!draftId) return 'unknown';
  const answer = state?.id === draftId ? state.isPublic : known.get(draftId);
  if (answer === undefined) return 'unknown';
  return answer ? 'public' : 'private';
}

/** Just the yes/no (false until we know). */
export function useIsPublicTable(draftId?: string | null): boolean {
  return useTableKind(draftId) === 'public';
}
