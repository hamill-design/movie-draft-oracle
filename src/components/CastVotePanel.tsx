import type { CSSProperties, ReactNode } from 'react';

const SECTION_SURFACE: CSSProperties = {
  background: 'var(--Section-Container, #0E0E0F)',
  boxShadow: '0px 0px 6px #3B0394',
  borderRadius: 8
};

export type CastVoteOption = { key: string; label: string };

/** Shared violet frame for voting (pick or results). */
export function VotingSessionCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[617px] mx-auto flex flex-col" style={SECTION_SURFACE}>
      <div className="flex flex-col items-center gap-6 p-6 w-full min-w-0">{children}</div>
    </div>
  );
}

type CastVotePanelProps = {
  title?: string;
  /** Bold player line + " Cast Your Vote For Who Won" (local pass-the-device steps). */
  voteAsPlayerName?: string;
  options: CastVoteOption[];
  selectedKey: string | null;
  onOptionClick: (key: string) => void;
  onConfirm: () => void;
  submitting?: boolean;
  footer?: ReactNode;
};

/** Stacked participant rows + Confirm Choice — matches voting UI spec. */
export function CastVotePanel({
  title = 'Cast Your Vote For Who Won',
  voteAsPlayerName,
  options,
  selectedKey,
  onOptionClick,
  onConfirm,
  submitting = false,
  footer
}: CastVotePanelProps) {
  return (
    <VotingSessionCard>
      <div className="w-full max-w-[617px] flex flex-col justify-center items-center gap-2">
        {voteAsPlayerName != null && voteAsPlayerName !== '' ? (
          <div className="w-full text-center font-brockmann text-xl leading-[28px] text-[var(--Text-Primary,#FCFFFF)] break-words">
            <span className="font-bold">{voteAsPlayerName}</span>
            <span className="font-medium"> Cast Your Vote For Who Won</span>
          </div>
        ) : (
          <div className="w-full text-center font-brockmann font-medium text-xl leading-[28px] text-[var(--Text-Primary,#FCFFFF)] break-words">
            {title}
          </div>
        )}
      </div>
      <div className="w-full max-w-[617px] flex flex-col justify-start items-stretch gap-4">
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onOptionClick(opt.key)}
            disabled={submitting}
            className="w-full min-h-[44px] min-w-0 py-3 px-6 rounded-[4px] text-center text-sm font-brockmann font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors truncate"
            style={{
              background:
                selectedKey === opt.key ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
              outline: '1px solid var(--Item-Stroke, #49474B)',
              outlineOffset: -1
            }}
            title={opt.label}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={submitting || selectedKey == null}
        onClick={onConfirm}
        className="px-6 py-3 rounded-[2px] justify-center items-center inline-flex font-brockmann font-semibold text-base leading-6 tracking-[0.32px] disabled:opacity-50 text-[#2B2D2D]"
        style={{ background: 'var(--Yellow-500, #FFD60A)' }}
      >
        Confirm Choice
      </button>
      {footer}
    </VotingSessionCard>
  );
}
