const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY';

/**
 * Clear draft presence using fetch keepalive so the request survives SPA route
 * changes and component unmount (async supabase.rpc is often aborted).
 */
export function clearDraftPresenceKeepalive(
  draftId: string,
  participantId: string,
  accessToken: string | null
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  void fetch(`${SUPABASE_URL}/rest/v1/rpc/clear_draft_presence`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_draft_id: draftId,
      p_participant_id: participantId,
    }),
    keepalive: true,
  }).catch(() => {
    // Best-effort during navigation teardown.
  });
}
