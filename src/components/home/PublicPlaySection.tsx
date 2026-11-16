import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import { OpenGamesList, useOpenGames } from '@/components/home/OpenGamesList';
import { useHomeQuickPlay } from '@/components/home/useHomeQuickPlay';

/**
 * Homepage invitation to public play: the drafts waiting for players, each with a Join button.
 * Renders nothing unless public play is open to this visitor, so it stays invisible until the switch
 * (set on the Play page by the admin) is moved off "Off", and "Just me" shows it to the admin only.
 */
export function PublicPlaySection() {
  const { available } = usePublicPlayAccess();
  if (!available) return null;
  return <PublicPlayBand />;
}

function PublicPlayBand() {
  const navigate = useNavigate();
  // Three cards across the 1400px column; "See all Drafts" opens the Play page for the rest.
  const { games } = useOpenGames(3);
  const { access, ask, prompt, busy, guest, direct, onQuickPlay } = useHomeQuickPlay();

  return (
    <section
      aria-label="Play Movie Drafter with other people"
      className="w-full border-y border-[#7142FF] bg-[#0E0E0F] px-6 pb-20 pt-16"
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-12">
        <div className="flex w-full flex-col items-start gap-4">
          {access.adminPreview && (
            <span className="rounded-full border border-[#FFD60A]/50 bg-[#2A2400] px-3 py-1 font-brockmann text-xs font-semibold text-[#FFD60A]">
              Only you can see this
            </span>
          )}
          <h2 className="m-0 font-chaney text-4xl font-normal uppercase leading-none text-[#FAFEFF] md:text-5xl lg:text-[56px]">
            Join a movie draft now
          </h2>
          <p className="m-0 max-w-[840px] font-brockmann text-base leading-relaxed text-greyscale-blue-300 [text-wrap:balance] md:text-lg">
            Quick Play drops you into a live game with other players: it joins one that's waiting, or opens a new one for
            the next person to join. Or pick a draft below.
          </p>
        </div>

        <div className="w-full">
          <OpenGamesList
            games={games}
            canJoinHere={direct}
            onGuestJoin={guest ? (g) => ask({ reason: 'join', returnTo: `/play?join=${g.draft_id}` }) : undefined}
            emptyAction={
              <Button
                onClick={onQuickPlay}
                disabled={busy}
                className="h-12 shrink-0 rounded-[2px] bg-[#7142FF] px-8 font-brockmann text-base font-semibold tracking-[0.32px] text-[#FCFFFF] hover:bg-[#5e32e0]"
              >
                {busy ? 'Finding a game…' : 'Quick Play'}
              </Button>
            }
          />
        </div>

        <Button
          onClick={() => navigate('/play')}
          className="h-auto rounded-[2px] bg-[#7142FF] px-8 py-[18px] font-brockmann text-lg font-semibold leading-6 text-[#FCFFFF] hover:bg-[#5e32e0]"
        >
          See all Drafts
        </Button>
      </div>
      {prompt}
    </section>
  );
}
