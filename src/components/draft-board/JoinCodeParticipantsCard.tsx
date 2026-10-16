import { Copy, Check } from 'lucide-react';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import { ParticipantAvatarGrid, type BoardRailParticipant } from './DraftBoardPlayerRail';

interface JoinCodeParticipantsCardProps {
  inviteCode: string;
  copySuccess: boolean;
  onCopy: () => void;
  participants: BoardRailParticipant[];
}

export function JoinCodeParticipantsCard({
  inviteCode,
  copySuccess,
  onCopy,
  participants,
}: JoinCodeParticipantsCardProps) {
  return (
    <div className="flex-1 min-w-[342px] p-6 rounded-lg bg-[hsl(var(--section-container))] shadow-[0px_0px_13px_12px_#680AFF] flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="text-[hsl(var(--text-primary))] text-2xl font-brockmann font-bold">Join Code</div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="px-3.5 py-1 rounded-full bg-[hsl(var(--ui-primary))] outline outline-1 outline-offset-[-1px] outline-[hsl(var(--text-primary))] font-mono text-lg tracking-wider text-[hsl(var(--text-primary))]">
            {inviteCode}
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="px-3 py-2 rounded-sm bg-[hsl(var(--ui-primary))] outline outline-1 outline-offset-[-1px] outline-[hsl(var(--text-primary))] text-[hsl(var(--text-primary))] text-sm font-brockmann font-medium flex items-center gap-2 hover:opacity-90"
          >
            {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <MultiPersonIcon className="w-5 h-5 text-[hsl(var(--text-purple))]" />
          <div className="text-[hsl(var(--text-primary))] text-xl font-brockmann font-medium">Participants</div>
        </div>
        <ParticipantAvatarGrid participants={participants} />
      </div>
    </div>
  );
}
