import { supabase } from '@/integrations/supabase/client';

/** What the database answers when a host invites people (see migration 15). */
export interface InviteResult {
  invited: { email: string; has_account: boolean }[];
  already: string[];
  rejected: { email: string; reason: 'invalid' | 'full' | string }[];
  seats_left: number;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong. Please try again.');
  return data as T;
}

/** Pulls email addresses out of whatever was typed or pasted (commas, spaces, semicolons, new lines). */
export function parseEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

export const inviteApi = {
  /** Host only. Each address holds a seat until the person takes it or the draft starts. */
  invite: (draftId: string, emails: string[]) => rpc<InviteResult>('invite_to_draft', { p_draft_id: draftId, p_emails: emails }),

  /** Host only. Takes back an invitation nobody has used. */
  revoke: (draftId: string, participantId: string) =>
    rpc<{ revoked: boolean }>('revoke_draft_invite', { p_draft_id: draftId, p_participant_id: participantId }),

  /** The invitation email (the seat is already held; this is just the message). Returns false if it could not be sent. */
  sendEmails: async (input: {
    draftId: string;
    draftTitle: string;
    hostName: string;
    emails: string[];
    theme: string;
    option: string;
  }): Promise<boolean> => {
    if (input.emails.length === 0) return true;
    try {
      const { data, error } = await supabase.functions.invoke('send-draft-invitations', {
        body: {
          draftId: input.draftId,
          draftTitle: input.draftTitle || 'a draft',
          hostName: input.hostName || 'A friend',
          participantEmails: input.emails,
          theme: input.theme,
          option: input.option ?? '',
        },
      });
      if (error) return false;
      const rows: { status?: string }[] = data?.invitations ?? [];
      return rows.length === 0 || rows.every((r) => r.status === 'sent' || r.status === 'simulated');
    } catch {
      return false;
    }
  },
};
