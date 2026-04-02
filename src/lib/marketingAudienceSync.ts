import { supabase } from '@/integrations/supabase/client';

/**
 * Syncs the current user's marketing preference to Resend (marketing Audience).
 * Safe to call when opted out (removes contact) or when Resend env is not configured (no-op on server).
 */
export async function syncMarketingAudience(): Promise<{ error: string | null }> {
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

  return { error: null };
}
