import { Button } from '@/components/ui/button';
import { QuickPlayCard } from '@/components/play/QuickPlayCard';
import type { SignInIntent } from '@/components/play/SignInPrompt';
import { OpenGamesList, useOpenGames } from '@/components/home/OpenGamesList';

interface GuestPlayHubProps {
  /** A table id from an invite link (`/play?join=<id>`), if the guest arrived through one. */
  inviteTable: string | null;
  /** Opens the sign-in prompt. */
  ask: (intent: SignInIntent) => void;
}

/**
 * What a signed-out guest sees on the Play page: everything a player sees (Quick Play and the open games),
 * with a banner to sign up. Trying to join or start anything asks them to sign in, then brings them back.
 */
export function GuestPlayHub({ inviteTable, ask }: GuestPlayHubProps) {
  const { games } = useOpenGames(12);
  const back = inviteTable ? `/play?join=${inviteTable}` : '/play';
  const reason = inviteTable ? 'invite' : 'general';

  return (
    <>
      <section
        aria-label="Sign in to play"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-brockmann text-lg font-semibold text-white">
            {inviteTable ? "You've been invited to a game" : 'Have a look around, then join in'}
          </h2>
          <p className="m-0 max-w-[560px] font-brockmann text-sm text-[#BDC3C2]">
            {inviteTable
              ? 'Sign in or create a free account to take your seat.'
              : "You're browsing as a guest. A free account lets you join games, start your own and earn leaderboard points."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button className="bg-[#680AFF] text-white hover:bg-[#794DFF]" onClick={() => ask({ reason, returnTo: back })}>
            Sign in
          </Button>
          <Button
            variant="outline"
            className="border-[#FFD60A] bg-transparent text-[#FFD60A] hover:bg-[#FFD60A]/10 hover:text-[#FFD60A]"
            onClick={() => ask({ reason, returnTo: back, mode: 'signup' })}
          >
            Create a free account
          </Button>
        </div>
      </section>

      <QuickPlayCard onGuestAction={() => ask({ reason: 'quick-play', returnTo: '/play?quick=play' })} />

      <section aria-labelledby="guest-open-games" className="flex flex-col gap-4">
        <h2 id="guest-open-games" className="m-0 font-brockmann text-xl font-medium text-white">Open games</h2>
        <OpenGamesList
          games={games}
          canJoinHere={false}
          onGuestJoin={(g) => ask({ reason: 'join', returnTo: `/play?join=${g.draft_id}` })}
        />
      </section>
    </>
  );
}
