import { Loader2, Plus } from 'lucide-react';

type TurnCellVariant = 'empty' | 'yourTurn' | 'selecting' | 'inactive' | 'otherTurn';

interface DraftBoardTurnCellProps {
  variant: TurnCellVariant;
  onActivate?: () => void;
  onCancel?: () => void;
}

export function DraftBoardTurnCell({ variant, onActivate, onCancel }: DraftBoardTurnCellProps) {
  if (variant === 'selecting') {
    return (
      <button
        type="button"
        onClick={onCancel}
        className="w-full min-h-[40px] px-6 py-2 rounded bg-[hsl(var(--ui-primary-pressed))] text-[hsl(var(--text-purple))] text-sm font-brockmann text-center hover:opacity-90"
      >
        Cancel
      </button>
    );
  }

  if (variant === 'yourTurn') {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="inline-flex w-full min-h-[40px] items-center justify-center gap-2.5 self-stretch rounded-[4px] border-none bg-brand-primary px-[68px] py-2 cursor-pointer hover:opacity-90"
        aria-label="Make your pick"
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center p-0.5">
          <Plus size={20} color="#FCFFFF" strokeWidth={2.5} aria-hidden />
        </span>
      </button>
    );
  }

  if (variant === 'inactive') {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '40px',
          paddingLeft: '68px',
          paddingRight: '68px',
          paddingTop: '8px',
          paddingBottom: '8px',
          background: 'var(--Brand-Primary, #7142FF)',
          borderRadius: '4px',
          opacity: 0.4,
        }}
      />
    );
  }

  if (variant === 'otherTurn') {
    return (
      <div
        className="min-h-[40px] w-full self-stretch rounded bg-purple-800"
        aria-hidden
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '40px',
        borderRadius: '4px',
        background: 'var(--Greyscale-Blue-800, #1A1D29)',
      }}
    />
  );
}

interface DraftBoardPickCellProps {
  title?: string;
}

export function DraftBoardPickCell({ title }: DraftBoardPickCellProps) {
  return (
    <div className="w-full min-h-[40px] px-1 flex items-center justify-center">
      <div className="text-center text-greyscale-blue-100 text-sm font-brockmann leading-4 line-clamp-2">
        {title}
      </div>
    </div>
  );
}

export function DraftBoardAiThinkingRow({ playerName, loading }: { playerName: string; loading?: boolean }) {
  return (
    <div className="w-full py-4 flex flex-col items-center gap-2 text-center">
      <div className="text-[hsl(var(--text-primary))] text-lg font-brockmann font-medium">
        {playerName} is thinking...
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-[hsl(var(--text-light-grey))] text-sm font-brockmann">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing movies...
        </div>
      )}
    </div>
  );
}
