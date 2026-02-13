import { Participant, normalizeParticipants, participantsToStrings } from '@/types/participant';

/**
 * Utility functions for managing pending draft saves in localStorage
 * Used when guests want to save drafts after logging in
 */

export interface PendingDraft {
  draftData: {
    title?: string;
    theme: string;
    option: string;
    participants: Participant[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  };
  draftId: string | null;
  timestamp: number;
  returnPath: string;
}

const PENDING_DRAFT_KEY = 'pending_draft_save';

/**
 * Store a draft in localStorage as a pending save
 * This is used when a guest wants to save a draft after logging in
 */
export const storePendingDraft = (
  draftData: PendingDraft['draftData'],
  draftId: string | null,
  returnPath: string
): void => {
  try {
    const pendingDraft: PendingDraft = {
      draftData,
      draftId,
      timestamp: Date.now(),
      returnPath,
    };
    localStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(pendingDraft));
    console.log('Stored pending draft in localStorage:', { draftId, returnPath });
  } catch (error) {
    console.error('Failed to store pending draft in localStorage:', error);
  }
};

/**
 * Retrieve the pending draft from localStorage
 */
export const getPendingDraft = (): PendingDraft | null => {
  try {
    const stored = localStorage.getItem(PENDING_DRAFT_KEY);
    if (!stored) return null;

    const pendingDraft = JSON.parse(stored) as PendingDraft;
    
    // Validate the structure
    if (!pendingDraft.draftData || !pendingDraft.returnPath) {
      console.warn('Invalid pending draft structure, clearing it');
      clearPendingDraft();
      return null;
    }

    return pendingDraft;
  } catch (error) {
    console.error('Failed to retrieve pending draft from localStorage:', error);
    clearPendingDraft();
    return null;
  }
};

/**
 * Remove the pending draft from localStorage
 */
export const clearPendingDraft = (): void => {
  try {
    localStorage.removeItem(PENDING_DRAFT_KEY);
    console.log('Cleared pending draft from localStorage');
  } catch (error) {
    console.error('Failed to clear pending draft from localStorage:', error);
  }
};

/**
 * Check if there is a pending draft in localStorage
 */
export const hasPendingDraft = (): boolean => {
  try {
    return localStorage.getItem(PENDING_DRAFT_KEY) !== null;
  } catch (error) {
    console.error('Failed to check for pending draft:', error);
    return false;
  }
};

