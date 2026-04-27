import { supabase } from '@/integrations/supabase/client';

/** localStorage key prefix — shared across tabs (unlike sessionStorage). */
export const MARKETING_AUDIENCE_SYNC_LS_PREFIX = 'md_ma_sync_v1_';

/** Skip background auto-sync if we succeeded recently (reduces duplicate Resend calls per tab/device). */
const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const inflight = new Map<string, Promise<{ error: string | null }>>();

function readCooldownTimestamp(userId: string): number | null {
  try {
    const raw = localStorage.getItem(`${MARKETING_AUDIENCE_SYNC_LS_PREFIX}${userId}`);
    if (!raw) return null;
    const at = JSON.parse(raw)?.at;
    return typeof at === 'number' ? at : null;
  } catch {
    return null;
  }
}

function writeCooldownTimestamp(userId: string): void {
  try {
    localStorage.setItem(
      `${MARKETING_AUDIENCE_SYNC_LS_PREFIX}${userId}`,
      JSON.stringify({ at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export type SyncMarketingAudienceOptions = {
  /** When true (e.g. Profile toggle), always call the edge function — bypasses cooldown. */
  force?: boolean;
};

/**
 * Syncs the current user's marketing preference to Resend (marketing Audience).
 * Safe to call when opted out (removes contact) or when Resend env is not configured (no-op on server).
 *
 * Background callers should omit `force` so a short localStorage cooldown dedupes across tabs
 * and React Strict Mode. User actions that change preference should pass `{ force: true }`.
 */
export async function syncMarketingAudience(
  options: SyncMarketingAudienceOptions = {},
): Promise<{ error: string | null }> {
  const force = options.force ?? false;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: null };
  }

  if (!force) {
    if (!user.email_confirmed_at) {
      return { error: null };
    }
    const lastOk = readCooldownTimestamp(user.id);
    if (lastOk != null && Date.now() - lastOk < SYNC_COOLDOWN_MS) {
      return { error: null };
    }
  }

  const uid = user.id;
  const existing = inflight.get(uid);
  if (existing) {
    return existing;
  }

  const run = (async (): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-marketing-audience', {
        body: {},
      });

      if (error) {
        return { error: error.message };
      }

      const payload = data as { error?: string; success?: boolean } | null;
      if (payload?.error) {
        return { error: payload.error };
      }

      writeCooldownTimestamp(uid);
      return { error: null };
    } finally {
      inflight.delete(uid);
    }
  })();

  inflight.set(uid, run);
  return run;
}
