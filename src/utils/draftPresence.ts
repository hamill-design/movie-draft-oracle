export type PresenceParticipantLike = {
  id?: string;
  participant_id?: string | null;
  user_id?: string | null;
  guest_participant_id?: string | null;
  is_ai?: boolean;
  last_seen_at?: string | null;
};

/** Heartbeat interval on the client (ms). */
export const DRAFT_PRESENCE_HEARTBEAT_MS = 15_000;

/** How recently a player must have heartbeated to count as online (ms). */
export const DRAFT_PRESENCE_ONLINE_THRESHOLD_MS = 30_000;

/** Poll server presence on this interval as a Realtime fallback (ms). */
export const DRAFT_PRESENCE_SYNC_MS = 15_000;

export function isParticipantOnline(
  participant: PresenceParticipantLike,
  nowMs: number = Date.now()
): boolean {
  if (participant.is_ai) return false;
  if (!participant.last_seen_at) return false;
  const lastSeenMs = new Date(participant.last_seen_at).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return nowMs - lastSeenMs <= DRAFT_PRESENCE_ONLINE_THRESHOLD_MS;
}

export function isPresenceHeartbeatUpdate(
  oldRow: Record<string, unknown> | null | undefined,
  newRow: Record<string, unknown> | null | undefined
): boolean {
  if (!newRow || !('last_seen_at' in newRow)) return false;
  if (!oldRow) return true;
  if (oldRow.last_seen_at === newRow.last_seen_at) return false;

  for (const key of Object.keys(oldRow)) {
    if (key === 'last_seen_at' || key === 'id') continue;
    if (key in newRow && oldRow[key] !== newRow[key]) return false;
  }

  return true;
}

export function mergeParticipantPresenceRows<T extends PresenceParticipantLike>(
  participants: T[],
  presenceRows: Array<{ id: string; last_seen_at: string | null }>
): T[] {
  const presenceById = new Map(presenceRows.map((row) => [row.id, row.last_seen_at]));
  return participants.map((participant) => {
    if (!participant.id || !presenceById.has(participant.id)) return participant;
    return { ...participant, last_seen_at: presenceById.get(participant.id) ?? null };
  });
}
