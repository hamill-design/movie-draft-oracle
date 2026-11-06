import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import { OpenGamesList, useOpenGames } from '@/components/home/OpenGamesList';
import { useHomeQuickPlay } from '@/components/home/useHomeQuickPlay';

/**
 * Homepage invitation to public play: Quick Play, and the open games people can join.
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
  const { games } = useOpenGames(6);
  const { access, ask, prompt, busy, guest, direct, onQuickPlay } = useHomeQuickPlay();

  return (
    <section
      aria-label="Play Movie Drafter with other people"
      className="w-full px-6 py-12 md:py-16"
      style={{ background: 'linear-gradient(160deg, #0d0020 0%, #160038 50%, #0d0020 100%)' }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
        <div className="flex max-w-[640px] flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/40 bg-purple-900/30 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span className="font-brockmann text-xs font-semibold uppercase tracking-widest text-purple-300">New</span>
            </div>
            {access.adminPreview && (
              <span className="rounded-full border border-[#FFD60A]/50 bg-[#2A2400] px-3 py-1 font-brockmann text-xs font-semibold text-[#FFD60A]">
                Only you can see this
              </span>
            )}
          </div>

          <h2 className="m-0 font-chaney text-4xl font-normal leading-tight text-greyscale-blue-100 md:text-5xl lg:text-[56px]">
            No friends handy?<br />Play with others
          </h2>

          <p className="m-0 max-w-md font-brockmann text-base leading-relaxed text-greyscale-blue-300 md:text-lg">
            Jump into a live game, or pick one below.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={onQuickPlay}
              disabled={busy}
              className="rounded-[2px] bg-[#7142FF] px-6 py-3 font-brockmann text-sm font-semibold text-white hover:bg-[#5e32e0]"
            >
              {busy ? 'Finding a game…' : 'Quick Play'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="m-0 font-brockmann text-xl font-semibold text-greyscale-blue-100">Open games</h3>
            <button
              type="button"
              onClick={() => navigate('/play')}
              className="inline-flex items-center gap-1.5 bg-transparent font-brockmann text-sm font-medium text-[#BCB2FF] hover:text-white"
            >
              See all open games <ArrowRight size={15} aria-hidden />
            </button>
          </div>
          <OpenGamesList
            games={games}
            canJoinHere={direct}
            onGuestJoin={guest ? (g) => ask({ reason: 'join', returnTo: `/play?join=${g.draft_id}` }) : undefined}
          />
        </div>
      </div>
      {prompt}
    </section>
  );
}
