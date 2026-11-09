// Small pure helpers for reloading a draft without the screen updating in stages.
// No imports from the app, so they can be tested on their own (supabase/tests/draftReload.test.mjs).

/** Strict deep equality for plain data (objects, arrays, strings, numbers, booleans, null). */
export function sameDeep(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameDeep(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    return ak.length === bk.length && ak.every((k) => k in (b as object) && sameDeep((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/**
 * True when everything in `next` is already in `prev` with the same value. `prev` may carry extra fields
 * (a draft that live updates have merged other columns into); those are ignored.
 */
export function sameFields(prev: unknown, next: unknown): boolean {
  if (prev === next) return true;
  if (Array.isArray(next)) {
    return Array.isArray(prev) && prev.length === next.length && next.every((v, i) => sameFields(prev[i], v));
  }
  if (next && typeof next === 'object') {
    if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return false;
    return Object.keys(next as object).every((k) => sameFields((prev as Record<string, unknown>)[k], (next as Record<string, unknown>)[k]));
  }
  return false;
}

/** Keep the old value when the new one says nothing new, so nothing downstream re-renders or re-runs. */
export function keepIfSame<T>(prev: T, next: T): T {
  return sameDeep(prev, next) ? prev : next;
}

/** Same, for a value the previous one may have extra fields on. */
export function keepIfCovers<T>(prev: T, next: T): T {
  return sameFields(prev, next) ? prev : next;
}

// ── Names, emails and avatars for the people in a draft ─────────────────────────────

export interface ProfileRow {
  id: string;
  email?: string | null;
  avatar_url?: string | null;
}

export interface EnricherDeps {
  /** Is this draft a public table? (Public tables never load emails.) */
  isPublicTable: (draftId: string) => Promise<boolean>;
  /** Fetch these people's profiles. Resolve null if it failed. */
  fetchProfiles: (userIds: string[], withEmail: boolean) => Promise<ProfileRow[] | null>;
}

interface WithUser {
  user_id: string | null;
  draft_id?: string;
}

/**
 * Adds each person's email and avatar to the rows a draft load returns. A draft is reloaded after every pick,
 * and the people in it almost never change, so each person is looked up once: later reloads (the common case)
 * make no network calls at all and so land in the same moment as the rest of the refresh, instead of a beat
 * behind it.
 */
export function createParticipantEnricher(deps: EnricherDeps) {
  const cache = new Map<string, Map<string, { email: string | null; avatar_url: string | null }>>();

  return async function enrich<P extends WithUser>(
    participants: P[],
  ): Promise<(P & { email: string | null; avatar_url: string | null })[] | P[]> {
    const userIds = [...new Set(participants.map((p) => p.user_id).filter((id): id is string => id !== null))];
    // No signed-in people: nothing to look up.
    if (userIds.length === 0) return participants;

    const draftId = participants[0]?.draft_id ?? '';
    let known = cache.get(draftId);
    if (!known) {
      known = new Map();
      cache.set(draftId, known);
    }

    const missing = userIds.filter((id) => !known!.has(id));
    if (missing.length > 0) {
      const isPublic = draftId ? await deps.isPublicTable(draftId) : false;
      const rows = await deps.fetchProfiles(missing, !isPublic);
      if (rows === null) {
        // A failed lookup shows what we have, and is tried again on the next reload.
        if (known.size === 0) return participants;
      } else {
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const id of missing) {
          const r = byId.get(id);
          known.set(id, { email: r?.email ?? null, avatar_url: r?.avatar_url ?? null });
        }
      }
    }

    return participants.map((p) => {
      const profile = p.user_id ? known!.get(p.user_id) : undefined;
      return { ...p, email: profile?.email ?? null, avatar_url: profile?.avatar_url ?? null };
    });
  };
}
