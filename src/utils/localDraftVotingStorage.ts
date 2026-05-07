const STORAGE_PREFIX = 'movie-draft-oracle:localWizard:';

export type LocalDraftVotingPersisted = {
  v: 1;
  skipped?: true;
  /** User chose "Yes" on Enable Voting — survives remount/refresh before any vote is saved. */
  enabledWizard?: true;
  votes?: Record<string, string>;
};

function storageKey(draftId: string): string {
  return `${STORAGE_PREFIX}${draftId}`;
}

export function getLocalDraftVotingPersisted(draftId: string): LocalDraftVotingPersisted | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(draftId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || (parsed as LocalDraftVotingPersisted).v !== 1) {
      return null;
    }
    const p = parsed as LocalDraftVotingPersisted;
    if (p.votes !== undefined && (typeof p.votes !== 'object' || p.votes === null || Array.isArray(p.votes))) {
      return null;
    }
    if (p.skipped !== undefined && p.skipped !== true) return null;
    if (p.enabledWizard !== undefined && p.enabledWizard !== true) return null;
    return p;
  } catch {
    return null;
  }
}

export function setLocalDraftVotingPersisted(
  draftId: string,
  partial: Pick<LocalDraftVotingPersisted, 'skipped' | 'votes' | 'enabledWizard'>
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const prev = getLocalDraftVotingPersisted(draftId);
    const next: LocalDraftVotingPersisted = {
      v: 1,
      ...prev,
      ...partial
    };
    if (partial.skipped === true) {
      delete next.votes;
      delete next.enabledWizard;
    }
    if (partial.votes !== undefined) {
      delete next.skipped;
    }
    sessionStorage.setItem(storageKey(draftId), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function clearLocalDraftVotingPersisted(draftId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(draftId));
  } catch {
    // ignore
  }
}

/**
 * Returns hydrated voting state for DraftComplete, or null if storage is absent or stale for this roster.
 * On stale vote keys vs participantNames, clears storage for this draftId.
 */
export function resolveHydratedLocalVoting(
  draftId: string,
  participantNames: string[],
  stored: LocalDraftVotingPersisted | null
): {
  addVoting: boolean | null;
  localVotes: Record<string, string>;
  localVoteStep: number;
} | null {
  if (!stored) return null;

  if (stored.skipped === true) {
    return { addVoting: false, localVotes: {}, localVoteStep: 0 };
  }

  const votes = stored.votes;
  const hasVoteEntries =
    votes &&
    typeof votes === 'object' &&
    !Array.isArray(votes) &&
    Object.keys(votes).length > 0;

  if (hasVoteEntries) {
    if (participantNames.length === 0) {
      return null;
    }

    const nameSet = new Set(participantNames);

    for (const [voter, choice] of Object.entries(votes!)) {
      if (!nameSet.has(voter) || !nameSet.has(choice)) {
        clearLocalDraftVotingPersisted(draftId);
        return null;
      }
    }

    const complete =
      participantNames.length > 0 && participantNames.every(n => votes![n] !== undefined);

    const step = complete ? participantNames.length : Object.keys(votes!).length;

    return {
      addVoting: true,
      localVotes: { ...votes! },
      localVoteStep: step
    };
  }

  if (stored.enabledWizard === true) {
    return { addVoting: true, localVotes: {}, localVoteStep: 0 };
  }

  return null;
}

export function getInitialLocalVotingUiState(
  draftId: string | undefined,
  isLocal: boolean,
  participantNames: string[]
): { addVoting: boolean | null; localVotes: Record<string, string>; localVoteStep: number } {
  if (!isLocal || !draftId) {
    return { addVoting: null, localVotes: {}, localVoteStep: 0 };
  }
  const stored = getLocalDraftVotingPersisted(draftId);
  const resolved = resolveHydratedLocalVoting(draftId, participantNames, stored);
  if (resolved) return resolved;
  return { addVoting: null, localVotes: {}, localVoteStep: 0 };
}
