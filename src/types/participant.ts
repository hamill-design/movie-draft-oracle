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
 * Stores as JSON strings to preserve isAI flag
 */
export function participantsToStrings(participants: Participant[]): string[] {
  return participants.map(p => JSON.stringify({ name: p.name, isAI: p.isAI }));
}

/**
 * Check if a participant array is in the old string[] format
 */
export function isLegacyParticipantFormat(value: any): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  // Check if it's an array of plain strings (old format)
  // vs JSON strings (new format) or Participant objects
  const firstItem = value[0];
  if (typeof firstItem === 'string') {
    // Check if it's a JSON string (starts with '{')
    if (firstItem.trim().startsWith('{')) {
      return false; // It's JSON format, not legacy
    }
    return true; // Plain string, legacy format
  }
  return false;
}

/**
 * Normalize participants to Participant[] format
 * Handles old string[], JSON string[], and new Participant[] formats
 */
export function normalizeParticipants(participants: string[] | Participant[]): Participant[] {
  if (participants.length === 0) return [];
  
  // Check if it's the old format (plain string[])
  if (isLegacyParticipantFormat(participants)) {
    return participantsFromStrings(participants as string[]);
  }
  
  // Check if it's JSON string format (from database)
  const firstItem = participants[0];
  if (typeof firstItem === 'string' && firstItem.trim().startsWith('{')) {
    // Parse JSON strings back to Participant objects
    return (participants as string[]).map(p => {
      try {
        const parsed = JSON.parse(p);
        return { name: parsed.name, isAI: parsed.isAI === true };
      } catch {
        // Fallback to plain string if JSON parsing fails
        return { name: p, isAI: false };
      }
    });
  }
  
  // Already in new format (Participant[])
  return participants as Participant[];
}
