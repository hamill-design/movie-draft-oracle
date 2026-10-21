import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatarUpload';
import type { LeagueSetup } from '@/hooks/useLeagueSetup';
import type { Participant } from '@/types/participant';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

/** Toggle + league picker shown at the top of the draft setup pages. */
export const LeagueToggleCard: React.FC<{ setup: LeagueSetup }> = ({ setup }) => {
  const { leagues, leaguesLoading, enabled, setEnabled, leagueId, setLeagueId, league } = setup;

  if (leaguesLoading || leagues.length === 0) return null;

  return (
    <div
      className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-4 font-brockmann"
      style={{ boxShadow: '0px 0px 6px #3B0394' }}
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
 * League members as one-tap invites, plus a summary of who will earn league
 * points. Renders nothing until a league is selected.
 */
export const LeagueMemberPicker: React.FC<{
  setup: LeagueSetup;
  participants: Participant[];
  hostName: string;
  selfId?: string | null;
  onAddEmails: (emails: string[]) => void;
}> = ({ setup, participants, hostName, selfId, onAddEmails }) => {
  const { league, members } = setup;

  const addedEmails = useMemo(
    () => new Set(participants.filter((p) => !p.isAI).map((p) => normalizeEmail(p.name))),
    [participants],
  );

  const available = useMemo(
    () =>
      members.filter((m) => {
        const email = m.profile?.email;
        return m.user_id !== selfId && !!email && !addedEmails.has(normalizeEmail(email));
      }),
    [members, selfId, addedEmails],
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

  return (
    <div className="flex flex-col gap-3">
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-greyscale-blue-400 text-xs font-brockmann font-medium m-0 uppercase tracking-widest">
              {league.name} members
            </p>
            <button
              type="button"
              onClick={() => onAddEmails(available.map((m) => m.profile!.email as string))}
              className="text-sm font-brockmann font-medium text-[#907AFF] hover:text-purple-200 transition-colors"
            >
              Add all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => onAddEmails([m.profile!.email as string])}
                className="inline-flex items-center gap-2 py-1 pl-1 pr-3 rounded-full bg-greyscale-purp-800 border border-purple-500/40 text-sm text-greyscale-blue-200 font-brockmann hover:bg-purple-900/50 hover:border-purple-400 transition-colors"
              >
                <Avatar className="size-6 shrink-0">
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-purple-800 text-[10px] text-greyscale-blue-100">
                    {getInitials(m.profile?.name, m.profile?.email)}
                  </AvatarFallback>
                </Avatar>
                {m.profile?.name ?? m.profile?.email ?? 'Member'}
              </button>
            ))}
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
