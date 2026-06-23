import { Clock } from 'lucide-react';

interface DraftStatusCardProps {
  pickNumber: number;
  currentTurnLabel: string;
  waitingTitle?: string;
  waitingSubtitle?: string;
  isWaiting?: boolean;
}

export function DraftStatusCard({
  pickNumber,
  currentTurnLabel,
  waitingTitle,
  waitingSubtitle,
  isWaiting = false,
}: DraftStatusCardProps) {
  return (
    <div className="flex-1 min-w-[342px] p-6 rounded-lg bg-[hsl(var(--section-container))] shadow-[0px_0px_13px_12px_#680AFF] flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-[hsl(var(--text-purple))]" />
        <div className="text-[hsl(var(--text-primary))] text-xl font-brockmann font-medium leading-7">
          Draft Status
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann">Pick Number:</span>
          <span className="text-[hsl(var(--text-primary))] text-sm font-brockmann font-medium">{pickNumber}</span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann shrink-0">Current Turn:</span>
          <span className="text-[hsl(var(--text-primary))] text-sm font-brockmann font-medium truncate text-right">
            {currentTurnLabel}
          </span>
        </div>
      </div>

      {isWaiting && waitingTitle && (
        <div className="p-6 rounded-lg bg-[hsl(var(--ui-primary))] outline outline-1 outline-offset-[-1px] outline-[hsl(var(--item-stroke))] flex flex-col items-center gap-3 text-center">
          <Clock className="w-5 h-5 text-[hsl(var(--text-light-grey))]" />
          <div className="text-[hsl(var(--text-primary))] text-base font-brockmann font-semibold">
            {waitingTitle}
          </div>
          {waitingSubtitle && (
            <div className="text-[hsl(var(--text-light-grey))] text-sm font-brockmann">{waitingSubtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
