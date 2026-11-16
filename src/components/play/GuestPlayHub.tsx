import { Button } from '@/components/ui/button';
import type { SignInIntent } from '@/components/play/SignInPrompt';
import { OpenDraftsBrowser } from '@/components/play/OpenDraftsBrowser';
import type { OpenGameRow } from '@/lib/publicPlayApi';

interface GuestPlayHubProps {
  /** The open drafts, loaded by the page. */
  games: OpenGameRow[] | null;
  reload: () => void | Promise<void>;
  /** A table id from an invite link (`/play?join=<id>`), if the guest arrived through one. */
  inviteTable: string | null;
  /** Opens the sign-in prompt. */
  ask: (intent: SignInIntent) => void;
}

/**
 * What a signed-out guest sees on the Play page: everything a player sees (the open drafts; Quick Play is the
 * button in the page header), with a banner to sign up. Trying to join or start anything asks them to sign in,
 * then brings them back.
 */
export function GuestPlayHub({ games, reload, inviteTable, ask }: GuestPlayHubProps) {
  const back = inviteTable ? `/play?join=${inviteTable}` : '/play';
  const reason = inviteTable ? 'invite' : 'general';

  return (
    <>
      <section
        aria-label="Sign in to play"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#49474B] bg-[#1D1D1F] p-6"
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
          <Button
            className="rounded-[2px] bg-[#7142FF] font-semibold text-white hover:bg-[#5e32e0]"
            onClick={() => ask({ reason, returnTo: back })}
          >
            Sign in
          </Button>
          <Button
            variant="outline"
            className="rounded-[2px] border-[#FFD60A] bg-transparent text-[#FFD60A] hover:bg-[#FFD60A]/10 hover:text-[#FFD60A]"
            onClick={() => ask({ reason, returnTo: back, mode: 'signup' })}
          >
            Create a free account
          </Button>
        </div>
      </section>

      <OpenDraftsBrowser
        games={games}
        reload={reload}
        canJoinHere={false}
        onGuestJoin={(g) => ask({ reason: 'join', returnTo: `/play?join=${g.draft_id}` })}
      />
    </>
  );
}
