import { PersonIcon } from '@/components/icons/PersonIcon';

interface DraftLobbyReadyPanelProps {
  isHost: boolean;
  joinedCount: number;
  enoughPlayers: boolean;
  loading?: boolean;
  onStartDraft: () => void;
}

export function DraftLobbyReadyPanel({
  isHost,
  joinedCount,
  enoughPlayers,
  loading = false,
  onStartDraft,
}: DraftLobbyReadyPanelProps) {
  if (!enoughPlayers) {
    return (
      <div className="w-full max-w-[1400px] px-6">
        <div className="p-6 rounded-lg flex flex-col items-center gap-[18px]">
          <PersonIcon className="w-6 h-6 text-[hsl(var(--text-primary))]" />
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-[hsl(var(--text-primary))] text-xl font-brockmann font-medium leading-7">
              Waiting For Players
            </div>
            <div className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann leading-5">
              Need at least 2 players to start the draft. Share the invite code below!
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="w-full max-w-[1400px] px-6">
        <div className="p-6 rounded-lg flex flex-col items-center gap-[18px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-[hsl(var(--text-primary))] text-xl font-brockmann font-medium leading-7">
              Waiting on the Host
            </div>
            <div className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann leading-5">
              The host will begin the draft when ready.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] px-6">
      <div className="p-6 rounded-lg flex flex-col items-center gap-[18px]">
        <div className="flex flex-col items-center gap-2 text-center w-full">
          <div className="text-[hsl(var(--text-primary))] text-xl font-brockmann font-medium leading-7">
            Everybody Ready?
          </div>
          <div className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann leading-5">
            {joinedCount} {joinedCount === 1 ? 'player has' : 'players have'} joined. Click below to
            randomize turn order and start the draft!
          </div>
        </div>
        <button
          type="button"
          onClick={onStartDraft}
          disabled={loading}
          className="px-8 py-[18px] rounded-[2px] bg-[hsl(var(--brand-primary))] text-[hsl(var(--text-primary))] text-lg font-brockmann font-semibold leading-6 hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? 'Starting...' : 'Start Draft'}
        </button>
      </div>
    </div>
  );
}

export function getMultiplayerDraftDisplayTitle(title: string): string {
  const upper = (title || 'DRAFT').toUpperCase();
  return upper.includes('DRAFT') ? upper : `${upper} DRAFT`;
}
