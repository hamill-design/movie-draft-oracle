import { User } from 'lucide-react';

export type BoardRailParticipant = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isCurrentTurn?: boolean;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function BoardAvatar({
  participant,
  size,
}: {
  participant: BoardRailParticipant;
  size: 'sm' | 'lg';
}) {
  const pixelSize = size === 'sm' ? 32 : 64;
  const fontSize = size === 'sm' ? 11 : 14;
  const ring = participant.isCurrentTurn
    ? 'outline outline-2 outline-offset-[-2px] outline-[hsl(var(--brand-primary))]'
    : '';

  return (
    <div
      className={`relative rounded-full flex-shrink-0 ${ring}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt={participant.name}
          className="rounded-full object-cover"
          style={{ width: pixelSize, height: pixelSize, display: 'block' }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: pixelSize,
            height: pixelSize,
            background: 'var(--Greyscale-Blue-800, #1A1D29)',
            color: 'var(--Text-Primary, #FCFFFF)',
            fontFamily: 'Brockmann, sans-serif',
            fontWeight: 600,
            fontSize,
            lineHeight: 1,
          }}
        >
          {getInitials(participant.name)}
        </div>
      )}
      {participant.showOnlineStatus && participant.isOnline && (
        <div
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: size === 'sm' ? 10 : 12,
            height: size === 'sm' ? 10 : 12,
            background: 'var(--Utility-Colors-Positive-Green-400, #41DA86)',
            border: '2px solid var(--Section-Container, #0E0E0F)',
          }}
        />
      )}
    </div>
  );
}

interface DraftBoardPlayerRailProps {
  participants: BoardRailParticipant[];
  rowHeights?: number[];
  pickerSpacerHeight?: number;
  pickerSpacerAfterRow?: number;
  headerHeight?: number;
}

export function DraftBoardPlayerRail({
  participants,
  rowHeights,
  pickerSpacerHeight = 0,
  pickerSpacerAfterRow = -1,
  headerHeight = 48,
}: DraftBoardPlayerRailProps) {
  return (
    <div
      className="absolute left-0 top-0 z-10 flex flex-col bg-[hsl(var(--section-container))] border-r border-[hsl(var(--ui-primary))]"
    >
      <div
        className="flex items-center justify-center px-4 border-b border-[hsl(var(--text-purple))]"
        style={{ minHeight: headerHeight }}
      >
        <User className="w-4 h-4 text-[hsl(var(--text-purple))]" />
      </div>
      <div className="p-1 flex flex-col">
        {participants.map((participant, rowIndex) => (
          <div key={participant.id}>
            <div
              className="flex items-center justify-center px-2 py-3"
              style={{ minHeight: rowHeights?.[rowIndex] ?? 56 }}
            >
              <BoardAvatar participant={participant} size="sm" />
            </div>
            {pickerSpacerAfterRow === rowIndex && pickerSpacerHeight > 0 && (
              <div style={{ height: pickerSpacerHeight }} aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ParticipantAvatarGridProps {
  participants: BoardRailParticipant[];
}

export function ParticipantAvatarGrid({ participants }: ParticipantAvatarGridProps) {
  return (
    <div className="flex flex-wrap gap-[18px]">
      {participants.map((p) => (
        <BoardAvatar key={p.id} participant={p} size="lg" />
      ))}
    </div>
  );
}
