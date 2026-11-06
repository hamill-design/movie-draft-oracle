import { useEffect, useMemo, useState } from 'react';
import { usePublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import { publicPlayApi, type DraftFormat } from '@/lib/publicPlayApi';

export interface OpenGameSettings {
  seats: number;
  /** Seconds per pick: 120 or less plays live, longer plays slowly over hours. */
  clock: number;
  rated: boolean;
  /** `datetime-local` value ("2026-11-20T19:30") or empty for "when I press Start". */
  startAt: string;
}

/** Live by default: "open to the public" is mostly about jumping in now. */
export const DEFAULT_OPEN_GAME_SETTINGS: OpenGameSettings = { seats: 4, clock: 60, rated: true, startAt: '' };

/**
 * State for the "Who can join?" choice on a draft setup screen: friends I invite (today's behaviour)
 * or open to the public. Offered only when public play is open to this visitor, never for league drafts
 * (those are for league members), and only to signed-in players.
 */
export function useOpenGameSetup(leagueEnabled: boolean) {
  const access = usePublicPlayAccess();
  const [wantsOpen, setWantsOpen] = useState(false);
  const [settings, setSettings] = useState<OpenGameSettings>(DEFAULT_OPEN_GAME_SETTINGS);
  const [submitting, setSubmitting] = useState(false);

  const offered = access.available;
  const canOpen = offered && access.signedIn && !leagueEnabled;
  const isOpen = wantsOpen && canOpen;

  // Turning on "Part of a league" takes the open choice away.
  useEffect(() => {
    if (leagueEnabled) setWantsOpen(false);
  }, [leagueEnabled]);

  const problem = useMemo(() => {
    if (!isOpen) return null;
    if (!access.hasName) return 'Choose your player name first. It is what other players will see.';
    if (settings.startAt && !(new Date(settings.startAt).getTime() > Date.now())) return 'Pick a start time in the future, or clear it.';
    return null;
  }, [isOpen, access.hasName, settings.startAt]);

  return { offered, canOpen, isOpen, wantsOpen, setWantsOpen, settings, setSettings, problem, submitting, setSubmitting, access };
}

export type OpenGameSetup = ReturnType<typeof useOpenGameSetup>;

export interface OpenGameDraft {
  title: string;
  theme: DraftFormat;
  option: string;
  categories: string[];
}

/** Opens the game on the server and returns its id. Throws with a plain-English message if it can't. */
export async function createOpenGame(settings: OpenGameSettings, game: OpenGameDraft): Promise<string> {
  const { draft_id } = await publicPlayApi.createTable({
    title: (game.title.trim() || 'Open game').slice(0, 200),
    theme: game.theme,
    option: game.option,
    categories: game.categories,
    tableSize: settings.seats,
    pickClockSeconds: settings.clock,
    rated: settings.rated,
    scheduledStartAt: settings.startAt ? new Date(settings.startAt).toISOString() : null,
  });
  return draft_id;
}
