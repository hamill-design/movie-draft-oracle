import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The pick clock for one draft, as decided by the server's "referee".
 * See docs/public-matchmaking-plan.md section 5.
 *
 * - Reads the current turn's deadline (and the server's own time, so a wrong phone clock
 *   can't make the countdown lie).
 * - When the deadline passes, nudges the referee (edge function `referee-tick`) so the
 *   overdue pick is made. Every player's screen does this, with a small random delay;
 *   the database guarantees the turn is only resolved once. A scheduled sweep on the
 *   server covers the case where nobody has the draft open.
 * - If the referee isn't installed yet (migration not applied), `status` becomes
 *   'unavailable' and the draft behaves exactly as it always has.
 */

interface ClockSnapshot {
  referee_enabled: boolean;
  pick_clock_seconds: number | null;
  deadline_at: string | null;
  server_now: string;
  participants: { participant_id: string; is_away: boolean; auto_pick_count: number }[];
  pick_sources: Record<string, 'auto' | 'bot'>;
}

export type DraftClockStatus = 'loading' | 'ready' | 'unavailable';

export interface UseDraftClockOptions {
  draftId?: string | null;
  participantId?: string | null;
  /** Changes after every pick; used to re-read the clock. */
  pickNumber?: number | null;
  turnParticipantId?: string | null;
  isComplete?: boolean;
}

export interface DraftClock {
  status: DraftClockStatus;
  /** The referee is switched on for this draft. */
  enabled: boolean;
  pickClockSeconds: number | null;
  /** Seconds left on the current turn, or null when there is no deadline. */
  secondsLeft: number | null;
  isOverdue: boolean;
  /** participant id -> true when that player is marked Away */
  awayByParticipantId: Record<string, boolean>;
  /** pick number -> 'auto' | 'bot' (picks made by the referee rather than the player) */
  pickSources: Record<string, 'auto' | 'bot'>;
  refresh: () => Promise<void>;
}

const NUDGE_EVERY_MS = 8000;
const MAX_NUDGE_JITTER_MS = 1500;

export function useDraftClock({
  draftId,
  participantId,
  pickNumber,
  turnParticipantId,
  isComplete,
}: UseDraftClockOptions): DraftClock {
  const [status, setStatus] = useState<DraftClockStatus>('loading');
  const [snapshot, setSnapshot] = useState<ClockSnapshot | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const serverOffsetMsRef = useRef(0);
  const lastNudgeAtRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!draftId || !participantId) return;
    try {
      // The function is new, so it isn't in the generated types yet.
      const { data, error } = await (supabase as any).rpc('get_draft_clock', {
        p_draft_id: draftId,
        p_participant_id: participantId,
      });
      if (error) throw error;
      const snap = data as ClockSnapshot;
      serverOffsetMsRef.current = Date.parse(snap.server_now) - Date.now();
      hasSnapshotRef.current = true;
      setSnapshot(snap);
      setStatus('ready');
    } catch {
      // Keep showing the last good clock through a blip; only give up if we never had one.
      if (!hasSnapshotRef.current) {
        setSnapshot(null);
        setStatus('unavailable');
      }
    }
  }, [draftId, participantId]);

  useEffect(() => {
    hasSnapshotRef.current = false;
    setStatus('loading');
    setSnapshot(null);
  }, [draftId]);

  useEffect(() => {
    void refresh();
  }, [refresh, pickNumber, turnParticipantId, isComplete]);

  const enabled = status === 'ready' && snapshot?.referee_enabled === true;
  const deadlineMs = enabled && snapshot?.deadline_at ? Date.parse(snapshot.deadline_at) : null;

  // Tick once a second, but only while there is a countdown to show.
  useEffect(() => {
    if (deadlineMs == null || isComplete) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineMs, isComplete]);

  const msLeft = deadlineMs != null ? deadlineMs - (nowMs + serverOffsetMsRef.current) : null;
  const secondsLeft = msLeft != null ? Math.max(0, Math.ceil(msLeft / 1000)) : null;
  const isOverdue = msLeft != null && msLeft <= 0;

  // When the clock runs out, ask the referee to make the pick (retrying every few seconds while overdue).
  const nudgeWindow = Math.floor(nowMs / NUDGE_EVERY_MS);
  useEffect(() => {
    if (!enabled || !isOverdue || isComplete || !draftId) return;
    if (Date.now() - lastNudgeAtRef.current < NUDGE_EVERY_MS - 500) return;
    lastNudgeAtRef.current = Date.now();
    const jitter = Math.floor(Math.random() * MAX_NUDGE_JITTER_MS);
    const timer = setTimeout(async () => {
      try {
        await supabase.functions.invoke('referee-tick', { body: { draftId } });
      } catch {
        // Not signed in (guest) or offline: the server's scheduled sweep covers it.
      }
      void refresh();
    }, jitter);
    return () => clearTimeout(timer);
  }, [enabled, isOverdue, isComplete, draftId, refresh, nudgeWindow]);

  const awayByParticipantId: Record<string, boolean> = {};
  for (const p of snapshot?.participants ?? []) {
    if (p.is_away) awayByParticipantId[String(p.participant_id)] = true;
  }

  return {
    status,
    enabled,
    pickClockSeconds: enabled ? snapshot?.pick_clock_seconds ?? null : null,
    secondsLeft,
    isOverdue,
    awayByParticipantId,
    pickSources: snapshot?.pick_sources ?? {},
    refresh,
  };
}
