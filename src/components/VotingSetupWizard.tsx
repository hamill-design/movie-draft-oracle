import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';

const TITLE_CLASS =
  'text-center justify-center flex flex-col text-[var(--Text-Primary,#FCFFFF)] text-2xl font-brockmann font-bold leading-8 tracking-[0.96px] break-words';

/** Design: 617px row, 16px gap, two equal columns — no wrap/stack. */
const BTN_ROW_PAIR = 'grid w-full max-w-[617px] mx-auto grid-cols-2 gap-4';

const BTN_ROW_TRIPLE = 'grid w-full max-w-[617px] mx-auto grid-cols-3 gap-4';

const BTN_PRIMARY =
  'w-full flex justify-center items-center px-6 py-3 rounded-[4px] font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] border border-transparent min-h-[44px] min-w-0';

function choiceButtonStyle(active: boolean): CSSProperties {
  if (active) {
    return { background: 'var(--Brand-Primary, #7142FF)' };
  }
  return {
    background: 'var(--UI-Primary, #1D1D1F)',
    outline: '1px solid var(--Item-Stroke, #49474B)',
    outlineOffset: -1
  };
}

export type VotingSetupDurationOption = { label: string; value: number };

type VotingSetupWizardProps = {
  /** Solo draft: Enable Voting segment only. */
  variant: 'local-enable' | 'full';
  addVoting: boolean | null;
  votingPublic: boolean;
  votingDuration: number;
  durationOptions: readonly VotingSetupDurationOption[];
  submittingSetup: boolean;
  sharePillText: string | null;
  shareCopyValue: string;
  toastCopySuccess: () => void;
  onEnableYes: () => void;
  onEnableNo: () => void;
  onGatherPublicYes: () => void;
  onGatherPublicNo: () => void;
  onDurationChange: (minutes: number) => void;
  onBeginVoting: () => void;
};

export function VotingSetupWizard({
  variant,
  addVoting,
  votingPublic,
  votingDuration,
  durationOptions,
  submittingSetup,
  sharePillText,
  shareCopyValue,
  toastCopySuccess,
  onEnableYes,
  onEnableNo,
  onGatherPublicYes,
  onGatherPublicNo,
  onDurationChange,
  onBeginVoting
}: VotingSetupWizardProps) {
  const [gatherResolved, setGatherResolved] = useState(false);

  useEffect(() => {
    if (addVoting !== true) setGatherResolved(false);
  }, [addVoting]);

  const enableResolved = addVoting !== null;
  const showGather = variant === 'full' && addVoting === true;
  const showTimeAndBegin = variant === 'full' && addVoting === true && gatherResolved;
  const showShareRow =
    variant === 'full' && gatherResolved && votingPublic && !!sharePillText && !!shareCopyValue;

  const gatherNoSelected = gatherResolved && votingPublic === false;

  return (
    <div
      className="w-full max-w-[617px] mx-auto flex flex-col"
      style={{
        background: 'var(--Section-Container, #0E0E0F)',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: 8
      }}
    >
      <div className="flex flex-col justify-start items-stretch gap-6 p-6 w-full min-w-0">
        <div className="w-full max-w-[617px] flex flex-col justify-center items-center gap-2">
          <div className={TITLE_CLASS}>Enable Voting?</div>
        </div>
        <div className={BTN_ROW_PAIR}>
          <button
            type="button"
            disabled={enableResolved && addVoting !== true}
            onClick={onEnableYes}
            className={BTN_PRIMARY}
            style={choiceButtonStyle(addVoting === true)}
          >
            <span className="text-center font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
              Yes
            </span>
          </button>
          <button
            type="button"
            disabled={enableResolved && addVoting !== false}
            onClick={onEnableNo}
            className={BTN_PRIMARY}
            style={choiceButtonStyle(addVoting === false)}
          >
            <span className="text-center font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
              No
            </span>
          </button>
        </div>

        {variant === 'full' && showGather && (
          <div className="self-stretch flex flex-col justify-start items-center gap-6">
            <div className="self-stretch flex flex-col justify-center items-center gap-2">
              <div className={TITLE_CLASS}>Gather Public Votes?</div>
            </div>
            <div className={`self-stretch ${BTN_ROW_PAIR}`}>
              <button
                type="button"
                disabled={gatherResolved}
                onClick={() => {
                  setGatherResolved(true);
                  onGatherPublicYes();
                }}
                className={BTN_PRIMARY}
                style={choiceButtonStyle(votingPublic === true && gatherResolved)}
              >
                <span className="text-center font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
                  Yes
                </span>
              </button>
              <button
                type="button"
                disabled={gatherResolved}
                onClick={() => {
                  setGatherResolved(true);
                  onGatherPublicNo();
                }}
                className={BTN_PRIMARY}
                style={choiceButtonStyle(gatherNoSelected)}
              >
                <span className="text-center font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
                  No
                </span>
              </button>
            </div>

            {showShareRow && (
              <div className="self-stretch min-w-[295px] max-w-[617px] mx-auto justify-center items-center gap-2.5 flex flex-nowrap">
                <div
                  className="pl-3.5 pr-3.5 pt-1 pb-1 rounded-full flex justify-start items-center min-w-0 flex-1 overflow-hidden"
                  style={{
                    background: 'var(--UI-Primary, #1D1D1F)',
                    outline: '1px solid var(--Text-Primary, #FCFFFF)',
                    outlineOffset: -1
                  }}
                >
                  <span className="text-[var(--Text-Primary,#FCFFFF)] text-lg leading-7 tracking-[1.08px] break-all font-[Andale_Mono,andale_mono,monospace] font-normal">
                    {sharePillText}
                  </span>
                </div>
                <button
                  type="button"
                  className="pl-3 pr-3 pt-2 pb-2 rounded-[2px] justify-center items-center gap-2 inline-flex shrink-0 font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)]"
                  style={{
                    background: 'var(--UI-Primary, #1D1D1F)',
                    outline: '1px solid var(--Text-Primary, #FCFFFF)',
                    outlineOffset: -1
                  }}
                  onClick={() => {
                    void navigator.clipboard.writeText(shareCopyValue).then(() => toastCopySuccess());
                  }}
                >
                  <Copy className="w-4 h-4 shrink-0 text-[var(--Text-Primary,#FCFFFF)]" />
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        {variant === 'full' && showTimeAndBegin && (
          <>
            <div className="w-full max-w-[617px] flex flex-col justify-center items-center gap-2">
              <div className={TITLE_CLASS}>Set A Time Limit</div>
            </div>
            <div className={BTN_ROW_TRIPLE}>
              {durationOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDurationChange(opt.value)}
                  className="flex w-full min-w-0 justify-center items-center px-6 py-3 rounded-[4px] min-h-[44px]"
                  style={
                    votingDuration === opt.value
                      ? { background: 'var(--Brand-Primary, #7142FF)' }
                      : {
                          background: 'var(--UI-Primary, #1D1D1F)',
                          outline: '1px solid var(--Item-Stroke, #49474B)',
                          outlineOffset: -1
                        }
                  }
                >
                  <span className="text-center font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={submittingSetup}
              onClick={onBeginVoting}
              className="self-center pl-6 pr-6 pt-3 pb-3 rounded-[2px] justify-center items-center inline-flex disabled:opacity-50"
              style={{ background: 'var(--Brand-Primary, #7142FF)' }}
            >
              <span className="text-[var(--Text-Primary,#FCFFFF)] text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                {submittingSetup ? 'Enabling…' : 'Begin Voting'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
