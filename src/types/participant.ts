/**
 * Participant type for drafts
 * Represents both human and AI participants
 */
export interface Participant {
  name: string;
  isAI: boolean;
}

/**
 * Convert string array to Participant array (for backward compatibility)
 * All participants default to isAI: false
 */
export function participantsFromStrings(names: string[]): Participant[] {
  return names.map(name => ({ name, isAI: false }));
}

/**
 * Convert Participant array to string array (for database storage)
 */
export function participantsToStrings(participants: Participant[]): string[] {
  return participants.map(p => p.name);
}

/**
 * Check if a participant array is in the old string[] format
 */
export function isLegacyParticipantFormat(value: any): value is string[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === 'string';
}

/**
 * Normalize participants to Participant[] format
 * Handles both old string[] and new Participant[] formats
 */
export function normalizeParticipants(participants: string[] | Participant[]): Participant[] {
  if (participants.length === 0) return [];
  
  // Check if it's the old format (string[])
  if (isLegacyParticipantFormat(participants)) {
    return participantsFromStrings(participants);
  }
  
  // Already in new format
  return participants as Participant[];
}
