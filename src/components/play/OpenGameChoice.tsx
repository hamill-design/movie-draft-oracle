import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Globe, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PublicNameForm } from '@/components/play/PublicNameForm';
import { useSignInPrompt } from '@/components/play/SignInPrompt';
import { refreshPublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import type { OpenGameSetup } from '@/hooks/useOpenGameSetup';
import { TABLE_CLOCK_OPTIONS } from '@/config/publicPlay';
import { cn } from '@/lib/utils';

const fieldClass = 'h-10 w-full rounded border border-[#49474B] bg-[#1D1D1F] px-3 font-brockmann text-sm text-white';
const labelClass = 'font-brockmann text-sm font-medium text-greyscale-blue-100';
const hintClass = 'font-brockmann text-xs text-greyscale-blue-300';

interface ChoiceProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}

function Choice({ active, disabled, onClick, icon, title, hint }: ChoiceProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-[6px] p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-brand-primary text-greyscale-blue-100' : 'bg-greyscale-purp-850 text-greyscale-blue-100 hover:bg-greyscale-purp-800',
      )}
      style={active ? undefined : { outline: '1px solid #49474B', outlineOffset: '-1px' }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-brockmann text-base font-semibold">{title}</span>
        <span className="font-brockmann text-xs opacity-80">{hint}</span>
      </span>
    </button>
  );
}

interface OpenGameChoiceProps {
  setup: OpenGameSetup;
  /** The draft is set to be part of a league: league drafts are for members, so they can't be opened up. */
  leagueEnabled: boolean;
}

/**
 * "Who can join?" for an online multiplayer draft: friends I invite (by email, as always) or open to the public.
 * Rendered only while public play is open to this visitor. When "open" is chosen the host picks seats, the pick clock,
 * rated or casual, and an optional start time; the screen then hides the email list and opens the game from the
 * form's own button.
 */
export function OpenGameChoice({ setup, leagueEnabled }: OpenGameChoiceProps) {
  const { offered, isOpen, setWantsOpen, settings, setSettings, access } = setup;
  const location = useLocation();
  // Guests can see the choice (it's a reason to sign up); choosing it asks them to sign in and brings them back here.
  const { ask, prompt } = useSignInPrompt();
  const chooseOpen = () => {
    if (access.signedIn) setWantsOpen(true);
    else ask({ reason: 'open', returnTo: `${location.pathname}${location.search}` });
  };

  const minStart = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  if (!offered) return null;
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div className="flex flex-col gap-4 self-stretch" data-testid="open-game-choice">
      <h3 id="who-can-join" className="m-0 font-brockmann text-lg font-medium text-greyscale-blue-100">Who can join?</h3>

      <div role="radiogroup" aria-labelledby="who-can-join" className="flex flex-col gap-3 sm:flex-row">
        <Choice
          active={!isOpen}
          onClick={() => setWantsOpen(false)}
          icon={<Mail className="h-5 w-5" aria-hidden />}
          title="Friends I invite"
          hint="Invite people by email. Only they can join."
        />
        <Choice
          active={isOpen}
          disabled={leagueEnabled}
          onClick={chooseOpen}
          icon={<Globe className="h-5 w-5" aria-hidden />}
          title="Open to the public"
          hint={access.signedIn ? 'Anyone can join from the homepage or the Play page.' : 'Sign in to open your game to everyone.'}
        />
      </div>

      {leagueEnabled && (
        <p className={cn(hintClass, 'm-0')}>League drafts are for league members, so they can't be opened to the public.</p>
      )}

      {isOpen && (
        <div className="flex flex-col gap-5 rounded bg-greyscale-purp-850 p-5" style={{ outline: '1px solid #49474B', outlineOffset: '-1px' }}>
          {!access.hasName ? (
            <PublicNameForm reason={access.nameReason} onSaved={refreshPublicPlayAccess} />
          ) : (
            <p className={cn(hintClass, 'm-0')}>
              Anyone can join, and other players see your public player name. You press Start when you're ready, or set a start time.
              The pick clock is locked once the game opens.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="open-seats" className={labelClass}>Seats</label>
              <select id="open-seats" value={settings.seats} onChange={(e) => set('seats', Number(e.target.value))} className={fieldClass}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} players</option>)}
              </select>
              <span className={hintClass}>Empty seats can be filled with bots when you start.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="open-clock" className={labelClass}>Time per pick</label>
              <select id="open-clock" value={settings.clock} onChange={(e) => set('clock', Number(e.target.value))} className={fieldClass}>
                <optgroup label="Live (everyone online together)">
                  {TABLE_CLOCK_OPTIONS.filter((o) => o.group === 'live').map((o) => <option key={o.label} value={o.seconds as number}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Slow (pick whenever, get a notification)">
                  {TABLE_CLOCK_OPTIONS.filter((o) => o.group === 'slow').map((o) => <option key={o.label} value={o.seconds as number}>{o.label}</option>)}
                </optgroup>
              </select>
              <span className={hintClass}>If someone runs out of time the game picks for them.</span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="open-rated" className={labelClass}>Rated game</label>
              <span className={hintClass}>Counts toward the leaderboard when 2 or more real players take part.</span>
            </div>
            <Switch id="open-rated" checked={settings.rated} onCheckedChange={(v) => set('rated', v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="open-start" className={labelClass}>Start time <span className={hintClass}>(optional)</span></label>
            <input
              id="open-start"
              type="datetime-local"
              min={minStart}
              value={settings.startAt}
              onChange={(e) => set('startAt', e.target.value)}
              className={cn(fieldClass, 'sm:max-w-[260px]')}
            />
            <span className={hintClass}>Players are reminded before it starts. You still press Start yourself.</span>
          </div>
        </div>
      )}
      {prompt}
    </div>
  );
}
