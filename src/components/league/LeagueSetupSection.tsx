import React, { useEffect, useMemo, useRef } from 'react';
import { Bot, Check, Mail, Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatarUpload';
import type { LeagueSetup } from '@/hooks/useLeagueSetup';
import type { LeagueMember } from '@/hooks/useLeagues';
import type { Participant } from '@/types/participant';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

/** The league member whose account email matches an invited email, if any. */
export const findLeagueMember = (members: LeagueMember[], email: string): LeagueMember | null =>
  members.find((m) => m.profile?.email && normalizeEmail(m.profile.email) === normalizeEmail(email)) ?? null;

/**
 * When the selected league changes, drop the players that were added from the
 * previous league's member list. The host, typed-in invites and AI players stay.
 * Turning the toggle off (or back on for the same league) keeps everyone.
 */
export const useResetParticipantsOnLeagueSwitch = (
  setup: LeagueSetup,
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>,
  hostName: string,
) => {
  const leagueId = setup.league?.id ?? null;
  const lastLeagueId = useRef<string | null>(null);
  const lastMemberEmails = useRef<Set<string>>(new Set());

  // Runs before the member-email snapshot below: right after a switch, `members`
  // is empty until the new league's members load, so the snapshot is still the
  // previous league's.
  useEffect(() => {
    if (!leagueId) return;
    if (lastLeagueId.current && lastLeagueId.current !== leagueId) {
      const previous = lastMemberEmails.current;
      setParticipants((prev) =>
        prev.filter((p) => p.isAI || p.name === hostName || !previous.has(normalizeEmail(p.name))),
      );
      lastMemberEmails.current = new Set();
    }
    lastLeagueId.current = leagueId;
  }, [leagueId, hostName, setParticipants]);

  useEffect(() => {
    if (!leagueId || setup.members.length === 0) return;
    lastMemberEmails.current = new Set(
      setup.members.map((m) => m.profile?.email).filter(Boolean).map((e) => normalizeEmail(e as string)),
    );
  }, [leagueId, setup.members]);
};

const IdentityAvatar: React.FC<{ name?: string | null; email?: string | null; avatarUrl?: string | null }> = ({
  name,
  email,
  avatarUrl,
}) => (
  <Avatar className="size-6 shrink-0">
    <AvatarImage src={avatarUrl ?? undefined} alt="" />
    <AvatarFallback className="bg-white/20 text-[10px] text-greyscale-blue-100">
      {getInitials(name, email)}
    </AvatarFallback>
  </Avatar>
);

/**
 * Leading icon + label for a participant chip on the setup pages. Typed-in
 * invites keep the mail icon and show the email; AI players keep the bot icon.
 * (League members aren't listed here, they live in the league members section.)
 */
export const ParticipantIdentity: React.FC<{
  participant: Participant;
  multiplayer: boolean;
}> = ({ participant, multiplayer }) => {
  if (participant.isAI) {
    return (
      <>
        <Bot size={16} className="shrink-0 text-greyscale-blue-100" />
        <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">{participant.name}</span>
      </>
    );
  }
  return (
    <>
      {multiplayer && <Mail size={16} className="shrink-0 text-greyscale-blue-100 max-md:hidden" />}
      <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">{participant.name}</span>
    </>
  );
};

/** The host's chip content: their photo (or initials) and name. No mail icon, the host isn't emailed. */
export const HostIdentity: React.FC<{ name: string; email?: string | null; avatarUrl?: string | null }> = ({
  name,
  email,
  avatarUrl,
}) => (
  <>
    <IdentityAvatar name={name} email={email} avatarUrl={avatarUrl} />
    <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">{name} (Host)</span>
  </>
);

/** Toggle + league picker shown at the top of the draft setup pages. */
export const LeagueToggleCard: React.FC<{ setup: LeagueSetup }> = ({ setup }) => {
  const { leagues, leaguesLoading, enabled, setEnabled, leagueId, setLeagueId, league } = setup;

  if (leaguesLoading || leagues.length === 0) return null;

  return (
    <div
      className="w-full p-6 bg-greyscale-purp-900 rounded-card flex flex-col gap-4 font-brockmann"
      style={{ boxShadow: 'var(--shadow-card-glow)' }}
    >
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 shrink-0 text-purple-300" aria-hidden />
        <div className="flex-1 min-w-0">
          <h2 id="league-toggle-label" className="text-greyscale-blue-100 text-xl font-medium leading-7 m-0">
            Part of a league
          </h2>
          <p className="text-greyscale-blue-300 text-sm leading-5 m-0">
            Count this draft toward your league standings.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-labelledby="league-toggle-label"
          className="data-[state=checked]:bg-brand-primary"
        />
      </div>

      {enabled && (
        <>
          {leagues.length > 1 ? (
            <RadioGroup
              value={leagueId ?? ''}
              onValueChange={setLeagueId}
              aria-label="League"
              className="max-h-60 gap-2 overflow-y-auto"
            >
              {leagues.map((l) => {
                const selected = leagueId === l.id;
                return (
                  <label
                    key={l.id}
                    htmlFor={`setup-league-${l.id}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-[2px] border px-4 py-3 text-sm transition-colors ${
                      selected
                        ? 'border-[#907AFF] bg-purple-800/40 text-[#FCFFFF]'
                        : 'border-[#49474B] bg-[#1D1D1F] text-[#BDC3C2] hover:border-[#907AFF]/60'
                    }`}
                  >
                    <RadioGroupItem
                      id={`setup-league-${l.id}`}
                      value={l.id}
                      className="border-[#907AFF] text-[#907AFF]"
                    />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  </label>
                );
              })}
            </RadioGroup>
          ) : (
            league && (
              <p className="text-greyscale-blue-100 text-sm m-0">
                This draft will be added to{' '}
                <strong className="font-semibold text-greyscale-blue-50">{league.name}</strong>.
              </p>
            )
          )}
          <p className="text-greyscale-blue-400 text-xs leading-5 m-0">
            League drafts are online multiplayer, so each player&apos;s account can earn league points.
          </p>
        </>
      )}
    </div>
  );
};

/**
 * The selected league's members as toggle buttons, plus a summary of who will
 * earn league points. Members stay in this section (selected = invited); the
 * Participants list is only for the host and typed-in emails. Renders nothing
 * until a league is selected.
 */
export const LeagueMemberPicker: React.FC<{
  setup: LeagueSetup;
  participants: Participant[];
  hostName: string;
  selfId?: string | null;
  onAddEmails: (emails: string[]) => void;
  onRemoveEmails: (emails: string[]) => void;
}> = ({ setup, participants, hostName, selfId, onAddEmails, onRemoveEmails }) => {
  const { league, members } = setup;

  const addedEmails = useMemo(
    () => new Set(participants.filter((p) => !p.isAI).map((p) => normalizeEmail(p.name))),
    [participants],
  );

  const candidates = useMemo(
    () => members.filter((m) => m.user_id !== selfId && !!m.profile?.email),
    [members, selfId],
  );

  const summary = useMemo(() => {
    const memberEmails = new Set(
      members.map((m) => m.profile?.email).filter(Boolean).map((e) => normalizeEmail(e as string)),
    );
    const humans = participants.filter((p) => !p.isAI && p.name !== hostName);
    const notMembers = humans.filter((p) => !memberEmails.has(normalizeEmail(p.name)));
    const aiCount = participants.filter((p) => p.isAI).length;
    return { humans, notMembers, aiCount };
  }, [members, participants, hostName]);

  if (!league) return null;

  const totalHumans = summary.humans.length + 1; // host always belongs to the league
  const memberHumans = totalHumans - summary.notMembers.length;
  const candidateEmails = candidates.map((m) => m.profile!.email as string);
  const allAdded = candidateEmails.length > 0 && candidateEmails.every((e) => addedEmails.has(normalizeEmail(e)));

  return (
    <div className="flex flex-col gap-3">
      {candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-greyscale-blue-400 text-xs font-brockmann font-medium m-0 uppercase tracking-widest">
              {league.name} members
            </p>
            <button
              type="button"
              onClick={() => (allAdded ? onRemoveEmails(candidateEmails) : onAddEmails(candidateEmails))}
              className="text-sm font-brockmann font-medium text-[#907AFF] hover:text-purple-200 transition-colors"
            >
              {allAdded ? 'Remove all' : 'Add all'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidates.map((m) => {
              const email = m.profile!.email as string;
              const selected = addedEmails.has(normalizeEmail(email));
              return (
                <button
                  key={m.user_id}
                  type="button"
                  aria-pressed={selected}
                  title={email}
                  onClick={() => (selected ? onRemoveEmails([email]) : onAddEmails([email]))}
                  className={`inline-flex items-center gap-2 py-1 pl-1 pr-3 rounded-full border text-sm font-brockmann transition-colors ${
                    selected
                      ? 'bg-brand-primary border-transparent text-greyscale-blue-100 hover:bg-purple-300'
                      : 'bg-greyscale-purp-800 border-purple-500/40 text-greyscale-blue-200 hover:bg-purple-900/50 hover:border-purple-400'
                  }`}
                >
                  <IdentityAvatar name={m.profile?.name} email={m.profile?.email} avatarUrl={m.profile?.avatar_url} />
                  {m.profile?.name ?? email}
                  {selected && <Check size={14} className="shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {summary.humans.length > 0 && (
        <div className="text-sm font-brockmann leading-5 text-greyscale-blue-300">
          <p className="m-0">
            <span className="font-semibold text-greyscale-blue-100">
              {memberHumans} of {totalHumans}
            </span>{' '}
            players are members of {league.name}.
          </p>
          {summary.notMembers.length > 0 && (
            <p className="m-0 mt-1 text-amber-300">
              Won&apos;t earn league points: {summary.notMembers.map((p) => p.name).join(', ')}
            </p>
          )}
          {summary.aiCount > 0 && (
            <p className="m-0 mt-1 text-greyscale-blue-400">AI players don&apos;t earn league points.</p>
          )}
        </div>
      )}
    </div>
  );
};
