import type { DraftParticipant, DraftPickRow, DraftRoom } from "../hooks/useDraftRoom";

// Same idea as the web's interactiveBoardModel: rows are the active players in
// turn order, columns are the draft's categories, and each pick lands in the
// cell for (its player's row, its category). Rows stay fixed for the whole draft.

export const participantKey = (p: DraftParticipant): string =>
  String(p.participant_id || p.user_id || p.guest_participant_id || p.id);

export interface BoardRow {
  participant: DraftParticipant;
  key: string;
}

export interface DraftBoard {
  categories: string[];
  rows: BoardRow[];
  /** `${rowIndex}|${category}` -> pick */
  cells: Map<string, DraftPickRow>;
  currentRowIndex: number;
  myRowIndex: number;
  picksByRow: DraftPickRow[][];
}

export function buildBoard(
  draft: DraftRoom,
  // all participants, sorted by created_at (the backend's player_id numbering)
  participantsByCreated: DraftParticipant[],
  picks: DraftPickRow[],
  myUserId: string | undefined,
): DraftBoard {
  // Turn order: first-round order from the draft's turn_order, then anyone missing.
  const ordered: DraftParticipant[] = [];
  const seen = new Set<string>();
  const turnOrder: any[] = Array.isArray(draft.turn_order) ? draft.turn_order : [];
  turnOrder
    .filter((t) => t.round === 1 || t.round === "1")
    .sort((a, b) => Number(a.pick_number) - Number(b.pick_number))
    .forEach((t) => {
      const id = String(t.participant_id || t.user_id || t.guest_participant_id || "");
      if (!id || seen.has(id)) return;
      const p = participantsByCreated.find((x) => participantKey(x) === id);
      if (p) {
        seen.add(id);
        ordered.push(p);
      }
    });
  participantsByCreated.forEach((p) => {
    if (!seen.has(participantKey(p))) ordered.push(p);
  });

  // Pre-invited players who never showed up don't get a row.
  const rows: BoardRow[] = ordered
    .filter((p) => p.status !== "invited")
    .map((p) => ({ participant: p, key: participantKey(p) }));

  const categories =
    draft.categories?.length > 0
      ? draft.categories
      : [...new Set([...picks].sort((a, b) => a.pick_order - b.pick_order).map((p) => p.category))];

  // The backend numbers players 1..N by created_at over ALL participants.
  const rowIndexByPlayerId = new Map<number, number>();
  participantsByCreated.forEach((p, i) => {
    const idx = rows.findIndex((r) => r.key === participantKey(p));
    if (idx >= 0) rowIndexByPlayerId.set(i + 1, idx);
  });

  const cells = new Map<string, DraftPickRow>();
  const picksByRow: DraftPickRow[][] = rows.map(() => []);
  for (const pick of picks) {
    const idx =
      rowIndexByPlayerId.get(Number(pick.player_id)) ??
      rows.findIndex((r) => r.participant.participant_name === pick.player_name);
    if (idx < 0) continue;
    cells.set(`${idx}|${pick.category}`, pick);
    picksByRow[idx].push(pick);
  }

  const currentId = draft.current_turn_participant_id || draft.current_turn_user_id;
  const currentRowIndex = currentId ? rows.findIndex((r) => r.key === String(currentId)) : -1;
  const myRowIndex = myUserId ? rows.findIndex((r) => r.participant.user_id === myUserId) : -1;

  return { categories, rows, cells, currentRowIndex, myRowIndex, picksByRow };
}

export function categoryLabel(category: string): string {
  const names: Record<string, string> = {
    "Academy Award Nominee or Winner": "Academy Award",
    "Blockbuster (minimum of $50 Mil)": "Blockbuster",
  };
  return names[category] ?? category;
}

export function posterUrl(path: string | null | undefined, size = "w185"): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}
