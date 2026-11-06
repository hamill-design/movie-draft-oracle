import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { publicPlayApi, type PublicPlayStatus } from '@/lib/publicPlayApi';

// One lookup per visitor (signed-in person or anonymous), shared by everything that asks:
// the header renders twice and the homepage section asks too.
const lookups = new Map<string, Promise<PublicPlayStatus | null>>();
const listeners = new Set<() => void>();

/** Forget what we know and ask again (after choosing a public name, say). Every hook instance updates. */
export function refreshPublicPlayAccess() {
  lookups.clear();
  listeners.forEach((l) => l());
}

export interface PublicPlayAccess {
  /** Public play is open to this visitor right now. */
  available: boolean;
  /** Only the admin can see it (the switch is on "Just me"), so ordinary visitors see nothing. */
  adminPreview: boolean;
  /** Signed in (public play itself needs an account). */
  signedIn: boolean;
  /** Has a player name strangers see (taken from their settings automatically); needed before joining or hosting. */
  hasName: boolean;
  /** When they have no name yet: why the one in their settings couldn't be used (shown above the name form). */
  nameReason: string | null;
  /** Has the first answer arrived? */
  ready: boolean;
}

const NOT_YET: PublicPlayAccess = { available: false, adminPreview: false, signedIn: false, hasName: false, nameReason: null, ready: false };

/**
 * Is public play open to this visitor? Decides whether the homepage band and the header "Play" link show.
 * Signed-out visitors are asked too: when the switch is on "Everyone", they should see the invitation
 * (the Play page then asks them to sign in). Returns "not available" if public play isn't installed yet.
 */
export function usePublicPlayAccess(): PublicPlayAccess {
  const { user } = useAuth();
  const [access, setAccess] = useState<PublicPlayAccess>(NOT_YET);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    const key = user?.id ?? 'anon';
    let cancelled = false;
    let lookup = lookups.get(key);
    if (!lookup) {
      lookup = publicPlayApi.statusWithName().catch(() => null);
      lookups.set(key, lookup);
      // Re-check now and then so the link appears soon after the switch is turned on.
      setTimeout(() => lookups.delete(key), 60_000);
    }
    lookup.then((s) => {
      if (cancelled) return;
      setAccess({
        available: s?.available === true,
        adminPreview: s?.available === true && s.mode === 'admin_only' && s.is_admin === true,
        signedIn: s?.signed_in === true,
        hasName: s?.has_public_name === true,
        nameReason: s?.name_reason ?? null,
        ready: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, tick]);

  return access;
}

/** Just the yes/no, for the header link. */
export function usePublicPlayAvailable(): boolean {
  return usePublicPlayAccess().available;
}

/** Stable reference for callers that want to refresh from an effect or handler. */
export function useRefreshPublicPlayAccess() {
  return useCallback(() => refreshPublicPlayAccess(), []);
}
