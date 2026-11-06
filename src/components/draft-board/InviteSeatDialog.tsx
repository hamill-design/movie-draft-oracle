import { useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { inviteApi, parseEmails, type InviteResult } from '@/lib/inviteApi';
import { getInitials } from '@/utils/avatarUpload';
import type { LeaguePerson } from '@/hooks/useDraftLeague';
import { cn } from '@/lib/utils';

export interface InviteSeatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  draftTitle: string;
  hostName: string;
  theme: string;
  option: string;
  /** The host can invite by email and from the league. Everyone else just gets the link or code. */
  canInvite: boolean;
  seatsLeft: number;
  /** A link or code anyone can use (public tables share a link, private drafts a join code). */
  share?: { label: string; value: string } | null;
  /** League drafts only: the league's members, other than you. */
  league?: { name: string; people: LeaguePerson[] } | null;
  /** Who is already in or invited (emails in any case, and account ids), so they aren't offered again. */
  taken: { emails: string[]; userIds: string[] };
  /** Called after an invitation went out, so the lobby can show the new seat. */
  onChanged: () => void;
}

type Note = { tone: 'ok' | 'warn'; lines: string[] };

const field =
  'h-10 w-full min-w-0 rounded-[2px] border border-[#49474B] bg-[#1D1D1F] px-3 font-brockmann text-sm text-[#FCFFFF] placeholder:text-[#7D7B80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907AFF]';
const smallButton =
  'h-10 shrink-0 rounded-[2px] px-4 font-brockmann text-sm font-semibold transition-colors disabled:opacity-60';

/** What happened, in a sentence or two. */
function summarize(result: InviteResult, mailed: boolean): Note {
  const lines: string[] = [];
  let tone: Note['tone'] = 'ok';
  if (result.invited.length > 0) {
    lines.push(`Invited ${result.invited.map((i) => i.email).join(', ')}.`);
    if (!mailed) {
      tone = 'warn';
      lines.push("The email didn't go out, but the seat is held. Share the link instead.");
    }
  }
  if (result.already.length > 0) lines.push(`${result.already.join(', ')} ${result.already.length === 1 ? 'is' : 'are'} already in.`);
  for (const r of result.rejected) {
    tone = 'warn';
    lines.push(r.reason === 'full' ? `No open seat left for ${r.email}.` : `${r.email} doesn't look like an email address.`);
  }
  return { tone, lines };
}

/**
 * The window an open seat opens. The host adds emails (and, in a league draft, taps league members); each
 * invitation holds a seat. Anyone seated can copy the link or code.
 */
export function InviteSeatDialog({
  open,
  onOpenChange,
  draftId,
  draftTitle,
  hostName,
  theme,
  option,
  canInvite,
  seatsLeft,
  share,
  league,
  taken,
  onChanged,
}: InviteSeatDialogProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [copied, setCopied] = useState(false);
  const [justInvited, setJustInvited] = useState<string[]>([]);

  const takenEmails = new Set([...taken.emails, ...justInvited].map((e) => e.trim().toLowerCase()));
  const takenIds = new Set(taken.userIds);
  const isTaken = (p: LeaguePerson) => takenIds.has(p.userId) || takenEmails.has(p.email.trim().toLowerCase());
  const candidates = (league?.people ?? []).filter((p) => !isTaken(p));
  const noSeats = seatsLeft <= 0;

  const send = async (emails: string[]) => {
    if (emails.length === 0 || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await inviteApi.invite(draftId, emails);
      const emailed = result.invited.map((i) => i.email);
      const mailed = await inviteApi.sendEmails({ draftId, draftTitle, hostName, emails: emailed, theme, option });
      setNote(summarize(result, mailed));
      if (emailed.length > 0) {
        setJustInvited((prev) => [...prev, ...emailed]);
        setText('');
        onChanged();
      }
    } catch (err) {
      setNote({ tone: 'warn', lines: [err instanceof Error ? err.message : 'Please try again.'] });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(parseEmails(text));
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: `Copy this ${share.label.toLowerCase()}`, description: share.value });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setNote(null);
          setText('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-brockmann text-xl">Invite someone</DialogTitle>
          <DialogDescription className="font-brockmann text-sm text-[#BDC3C2]">
            {noSeats
              ? 'Every seat is taken.'
              : `${seatsLeft} open ${seatsLeft === 1 ? 'seat' : 'seats'}. An invitation holds a seat until the draft starts.`}
          </DialogDescription>
        </DialogHeader>

        {canInvite && (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="invite-emails" className="font-brockmann text-sm font-medium text-[#FCFFFF]">
              Email
            </label>
            <div className="flex gap-2">
              <input
                id="invite-emails"
                type="text"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="friend@example.com"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy || noSeats}
                className={cn(field, 'disabled:opacity-60')}
              />
              <button
                type="submit"
                disabled={busy || noSeats || parseEmails(text).length === 0}
                className={cn(smallButton, 'bg-[#680AFF] text-[#FCFFFF] hover:bg-[#794DFF]')}
              >
                {busy ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            <p className="m-0 font-brockmann text-xs text-[#BDC3C2]">Separate several addresses with commas.</p>
          </form>
        )}

        {note && note.lines.length > 0 && (
          <div
            role="status"
            className={cn(
              'flex flex-col gap-1 rounded-[2px] border px-3 py-2 font-brockmann text-sm',
              note.tone === 'ok' ? 'border-[#7CE0A0]/40 text-[#7CE0A0]' : 'border-[#FFD60A]/40 text-[#FFD60A]',
            )}
          >
            {note.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}

        {canInvite && league && league.people.length > 0 && (
          <section aria-label={`${league.name} members`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 font-brockmann text-sm font-medium text-[#FCFFFF]">{league.name} members</h3>
              {candidates.length > 1 && !noSeats && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send(candidates.slice(0, seatsLeft).map((p) => p.email))}
                  className="bg-transparent font-brockmann text-sm font-medium text-[#C9B8FF] underline disabled:opacity-60"
                >
                  {candidates.length > seatsLeft ? `Invite ${seatsLeft}` : 'Invite all'}
                </button>
              )}
            </div>
            <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto p-0">
              {league.people.map((p) => {
                const already = isTaken(p);
                return (
                  <li key={p.userId} className="flex items-center gap-3 rounded-[2px] px-1 py-1">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-white/20 text-[11px] text-[#FCFFFF]">{getInitials(p.name, p.email)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate font-brockmann text-sm text-[#FCFFFF]" title={p.email}>
                      {p.name}
                    </span>
                    {already ? (
                      <span className="inline-flex items-center gap-1 font-brockmann text-xs text-[#BDC3C2]">
                        <Check size={14} aria-hidden /> Invited
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || noSeats}
                        onClick={() => void send([p.email])}
                        className="rounded-[2px] border border-[#49474B] bg-transparent px-3 py-1 font-brockmann text-xs font-semibold text-[#FCFFFF] transition-colors hover:bg-[#1D1D1F] disabled:opacity-60"
                      >
                        Invite
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {share && (
          <div className="flex flex-col gap-2">
            <span className="font-brockmann text-sm font-medium text-[#FCFFFF]">{canInvite ? `Or share the ${share.label.toLowerCase()}` : share.label}</span>
            <div className="flex gap-2">
              <input
                readOnly
                value={share.value}
                aria-label={share.label}
                onFocus={(e) => e.currentTarget.select()}
                className={cn(field, 'text-[#BDC3C2]')}
              />
              <button
                type="button"
                onClick={() => void copy()}
                className={cn(smallButton, 'inline-flex items-center gap-2 border border-[#49474B] bg-transparent text-[#FCFFFF] hover:bg-[#1D1D1F]')}
              >
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {!canInvite && (
          <p className="m-0 font-brockmann text-xs text-[#BDC3C2]">Only the host can invite by email.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
