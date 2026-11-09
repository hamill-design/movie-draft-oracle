import { supabase } from '@/integrations/supabase/client';

/**
 * Thin, typed wrappers around the public-play database functions
 * (supabase/migrations/20261105*). The functions are new, so they aren't in the generated
 * Supabase types yet. Errors carry the plain-English message the database raised.
 */

export type PublicPlayMode = 'off' | 'admin_only' | 'on';
export type TableSpeed = 'live' | 'slow';
export type DraftFormat = 'year' | 'people' | 'spec-draft';

export interface PublicPlayStatus {
  mode: PublicPlayMode;
  available: boolean;
  signed_in: boolean;
  is_admin: boolean;
  has_public_name: boolean;
  public_name: string | null;
  banned: boolean;
  banned_until: string | null;
  cooldown_until: string | null;
  /** Set by the app (not the database): why the name in the player's settings couldn't be used, so the form can say so. */
  name_reason?: string | null;
}

/** What claim_public_name answers: the name now in use, or why the player has to choose one. */
export interface ClaimNameResult {
  public_name: string | null;
  claimed?: boolean;
  reason?: string;
}

export interface PublicTableRow {
  draft_id: string;
  title: string;
  theme: DraftFormat | string;
  option: string;
  categories: string[];
  table_size: number;
  joined_count: number;
  seats_open: number;
  host_user_id: string | null;
  host_name: string | null;
  host_avatar_url: string | null;
  pick_clock_seconds: number;
  speed: TableSpeed;
  scheduled_start_at: string | null;
  rated: boolean;
  match_source: string;
  created_at: string;
  i_joined: boolean;
}

export interface TableParticipant {
  user_id: string | null;
  name: string;
  avatar_url: string | null;
  is_host: boolean;
  is_ai: boolean;
  ready: boolean;
  /** Their open draft page checked in within the last 30 seconds (absent until the lobby-merge migration is applied). */
  online?: boolean;
  is_me: boolean;
  /** 'invited' = a seat held for someone who hasn't taken it yet (no account on it). Absent before the invite migration. */
  status?: 'joined' | 'invited';
  /** Held seats only, and only for the host: what to pass to take the invitation back. */
  participant_id?: string | null;
  /** Held seats only, and only for the host: the address it was sent to. */
  email?: string | null;
}

export type TableStatus = 'forming' | 'active' | 'complete' | 'cancelled';

/** What the host can change in a lobby. Any of them can be left out. */
export interface TableSettingsPatch {
  seats?: number;
  clock?: number;
  rated?: boolean;
  categories?: string[];
}

export interface TableInfo {
  /** A Quick Play lobby (the system opened it for its host). */
  is_quick: boolean;
  draft_id: string;
  title: string;
  theme: string;
  option: string;
  categories: string[];
  status: TableStatus;
  cancel_reason: string | null;
  match_source: string;
  table_size: number;
  pick_clock_seconds: number;
  speed: TableSpeed;
  scheduled_start_at: string | null;
  rated: boolean;
  host_handoff_count: number;
  ready_check_expires_at: string | null;
  server_now: string;
  i_joined: boolean;
  i_am_host: boolean;
  participants: TableParticipant[];
}

export interface MyTableRow {
  draft_id: string;
  title: string;
  status: TableStatus;
  speed: TableSpeed;
  scheduled_start_at: string | null;
  i_am_host: boolean;
}

/** One card on the homepage's "open games" list (safe for signed-out visitors: names only, never emails). */
export interface OpenGameRow {
  draft_id: string;
  title: string;
  theme: DraftFormat | string;
  option: string;
  table_size: number;
  joined_count: number;
  seats_open: number;
  host_name: string | null;
  pick_clock_seconds: number;
  speed: TableSpeed;
  scheduled_start_at: string | null;
  rated: boolean;
  created_at: string;
  i_joined: boolean;
}

/** What Quick Join answers: a game it put you in, or {found:false} when nothing is open right now. */
export interface QuickJoinResult {
  found: boolean;
  draft_id?: string;
  match_source?: 'quick' | 'open';
  already_in?: boolean;
  joined?: number;
}

export interface QuickStartResult {
  draft_id: string;
  status: string;
  already_in: boolean;
  created?: boolean;
}

export interface CreateTableInput {
  title: string;
  theme: DraftFormat;
  option: string;
  categories: string[];
  tableSize: number;
  pickClockSeconds: number;
  rated: boolean;
  scheduledStartAt: string | null;
}

export type ReportReason = 'abusive_name' | 'cheating' | 'harassment' | 'spam' | 'other';

export interface AdminReport {
  id: string;
  created_at: string;
  status: string;
  reason: ReportReason;
  details: string | null;
  draft_id: string | null;
  reporter_id: string;
  reporter_name: string | null;
  reported_id: string;
  reported_name: string | null;
  reported_is_banned: boolean;
  reports_against_total: number | string;
}

export interface LeaderboardRow {
  rank: number | string;
  user_id: string;
  public_name: string;
  avatar_url: string | null;
  points: number | string;
  rated_games: number | string;
  wins: number | string;
}

export interface MyStanding {
  ranked: boolean;
  rank?: number | string;
  points?: number | string;
  rated_games?: number | string;
  wins?: number | string;
  players: number | string;
}

export interface PlayerCardData {
  user_id: string;
  public_name: string;
  avatar_url: string | null;
  rated_games: number | string;
  wins: number | string;
  points_all_time: number | string;
  points_this_quarter: number | string;
  public_games: number | string;
  reliability: number | string;
}

export interface DraftResultRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  rank: number | null;
  raw_score: number | string;
  points: number | string;
  multiplier: number | string;
  eligible: boolean;
  own_picks: number;
  total_picks: number;
  is_me: boolean;
}

export interface DraftResultsData {
  draft_id: string;
  rated: boolean;
  /** in_progress | pending (waiting for scores) | final | void | unrated */
  status: 'in_progress' | 'pending' | 'final' | 'void' | 'unrated';
  rows: DraftResultRow[];
}

export interface QuickPoolEntry {
  id: string;
  kind: 'year' | 'actor' | 'spec';
  theme: string;
  option: string;
  label: string;
  categories: string[];
  enabled: boolean;
}

export interface StartResult {
  status: 'started' | 'ready_check' | 'cancelled' | string;
  expires_at?: string;
  humans?: number;
  bots_added?: number;
  rated?: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong. Please try again.');
  return data as T;
}

export const publicPlayApi = {
  status: () => rpc<PublicPlayStatus>('public_play_status'),
  /**
   * Public play status, and if the player has no public name yet, use the name from their settings
   * (cleaned up to fit the rules). They are only asked for a name when that can't work, and `name_reason` says why.
   */
  statusWithName: async (): Promise<PublicPlayStatus> => {
    const s = await rpc<PublicPlayStatus>('public_play_status');
    if (s.signed_in && s.available && !s.banned && !s.has_public_name) {
      try {
        const c = await rpc<ClaimNameResult>('claim_public_name');
        if (c.public_name) return { ...s, has_public_name: true, public_name: c.public_name };
        return { ...s, name_reason: c.reason ?? null };
      } catch {
        // Not installed yet, or a hiccup: fall back to asking for a name.
      }
    }
    return s;
  },
  claimName: () => rpc<ClaimNameResult>('claim_public_name'),
  setName: (name: string) => rpc<{ public_name: string }>('set_public_name', { p_name: name }),
  setMode: (mode: PublicPlayMode) => rpc<string>('set_public_play_mode', { p_mode: mode }),

  listTables: (speed: TableSpeed | null, theme: string | null) =>
    rpc<PublicTableRow[]>('list_public_tables', { p_speed: speed, p_theme: theme, p_limit: 50 }),
  myTables: () => rpc<MyTableRow[]>('my_public_tables'),
  tableInfo: (draftId: string) => rpc<TableInfo>('get_table_info', { p_draft_id: draftId }),

  createTable: (i: CreateTableInput) =>
    rpc<{ draft_id: string }>('create_public_table', {
      p_title: i.title,
      p_theme: i.theme,
      p_option: i.option,
      p_categories: i.categories,
      p_table_size: i.tableSize,
      p_pick_clock_seconds: i.pickClockSeconds,
      p_rated: i.rated,
      p_scheduled_start_at: i.scheduledStartAt,
    }),
  joinTable: (draftId: string) => rpc<{ draft_id: string; already_joined: boolean }>('join_public_table', { p_draft_id: draftId }),
  leaveTable: (draftId: string) => rpc<{ left: boolean; table_cancelled: boolean }>('leave_public_table', { p_draft_id: draftId }),
  /** The host's Start. Empty seats are always filled with bots (the old flag is still sent for older databases). */
  startTable: (draftId: string) => rpc<StartResult>('start_public_table', { p_draft_id: draftId, p_fill_bots: true }),
  confirmReady: (draftId: string) => rpc<{ all_ready: boolean }>('confirm_ready', { p_draft_id: draftId }),
  /**
   * The host changes the draft until it starts. Leave a setting out to keep it. Seats are 2 to 6 (never fewer than
   * the people already at the table), the clock is seconds per pick, categories come from the standard list.
   */
  setTableSettings: (draftId: string, s: TableSettingsPatch) =>
    rpc<{ table_size: number; pick_clock_seconds: number; rated: boolean; categories: string[] }>('set_table_settings', {
      p_draft_id: draftId,
      p_table_size: s.seats ?? null,
      p_pick_clock_seconds: s.clock ?? null,
      p_rated: s.rated ?? null,
      p_categories: s.categories ?? null,
    }),
  setSchedule: (draftId: string, iso: string | null) =>
    rpc<{ scheduled_start_at: string | null; changed: boolean }>('set_table_schedule', { p_draft_id: draftId, p_scheduled_start_at: iso }),
  cancelTable: (draftId: string) => rpc<void>('cancel_public_table', { p_draft_id: draftId }),

  reportPlayer: (userId: string, draftId: string | null, reason: ReportReason, details: string) =>
    rpc<void>('report_player', { p_reported: userId, p_draft: draftId, p_reason: reason, p_details: details || null }),
  blockPlayer: (userId: string) => rpc<void>('block_player', { p_user: userId }),
  unblockPlayer: (userId: string) => rpc<void>('unblock_player', { p_user: userId }),

  quickAvailable: async (): Promise<boolean> => {
    try {
      return (await rpc<boolean>('quick_match_available')) === true;
    } catch {
      return false;
    }
  },
  /** Jump into a live open game (hosted by a player or by the system). {found:false} if there isn't one. */
  quickJoin: () => rpc<QuickJoinResult>('quick_join'),
  /** Open a new Quick Match of your own; others can jump in while it waits. */
  quickStart: () => rpc<QuickStartResult>('quick_start'),
  /** The homepage list of games people can join. Works for signed-out visitors too. */
  openGames: (limit = 12) => rpc<OpenGameRow[]>('list_open_games_preview', { p_limit: limit }),
  quickLeave: (draftId: string) => rpc<{ left: boolean; match_cancelled: boolean }>('quick_match_leave', { p_draft_id: draftId }),

  adminQuickPool: () => rpc<QuickPoolEntry[]>('admin_list_quick_pool'),
  adminSetQuickEnabled: (id: string, enabled: boolean) => rpc<void>('admin_set_quick_pool_enabled', { p_id: id, p_enabled: enabled }),
  adminSetQuickKindEnabled: (kind: string, enabled: boolean) => rpc<number>('admin_set_quick_pool_kind_enabled', { p_kind: kind, p_enabled: enabled }),
  adminAddQuickActor: (name: string) => rpc<string>('admin_add_quick_pool_actor', { p_name: name }),
  adminRemoveQuickEntry: (id: string) => rpc<void>('admin_remove_quick_pool_entry', { p_id: id }),
  adminSyncQuickPool: () => rpc<number>('admin_sync_quick_pool'),

  leaderboard: (scope: 'quarter' | 'all') => rpc<LeaderboardRow[]>('get_leaderboard', { p_scope: scope, p_limit: 50 }),
  myStanding: (scope: 'quarter' | 'all') => rpc<MyStanding>('get_my_standing', { p_scope: scope }),
  playerCard: (userId: string) => rpc<PlayerCardData>('get_player_card', { p_user: userId }),
  draftResults: (draftId: string) => rpc<DraftResultsData>('get_draft_results', { p_draft: draftId }),

  isPublicTable: async (draftId: string): Promise<boolean> => {
    try {
      return (await rpc<boolean>('draft_is_public', { p_draft_id: draftId })) === true;
    } catch {
      return false; // not installed yet: behave like a normal draft
    }
  },
  /** Same question, but a failed lookup throws, so an answer can be remembered only when it was a real one. */
  isPublicTableStrict: async (draftId: string): Promise<boolean> =>
    (await rpc<boolean>('draft_is_public', { p_draft_id: draftId })) === true,

  adminReports: (status: string | null) => rpc<AdminReport[]>('admin_list_reports', { p_status: status, p_limit: 100 }),
  adminResolve: (id: string, action: 'dismissed' | 'warned' | 'banned', banDays: number | null) =>
    rpc<void>('admin_resolve_report', { p_report: id, p_action: action, p_ban_days: banDays }),
  adminUnban: (userId: string) => rpc<void>('admin_unban', { p_user: userId }),
};
