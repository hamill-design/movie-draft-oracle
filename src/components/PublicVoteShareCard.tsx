import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type PublicVoteShareCardProps = {
  voteUrl: string;
  onCopy: () => void;
};

/** “Voting is Open” + share URL pill + Copy + QR — aligned with voting cards (617px max). */
export function PublicVoteShareCard({ voteUrl, onCopy }: PublicVoteShareCardProps) {
  return (
    <div
      className="w-full max-w-[617px] mx-auto flex flex-col min-w-0"
      style={{
        background: 'var(--Section-Container, #0E0E0F)',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: 8
      }}
    >
      <div className="flex flex-col items-center gap-5 p-6 w-full min-w-0">
        <div className="w-full flex flex-col items-stretch gap-2">
          <div className="w-full flex flex-col items-center">
            <div className="w-full text-center flex flex-col font-brockmann font-medium text-xl leading-7 text-[var(--Text-Primary,#FCFFFF)] break-words">
              Voting is Open
            </div>
          </div>
          <div className="w-full flex flex-col items-center">
            <p className="w-full text-center flex flex-col font-brockmann font-normal text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] break-words">
              Other participants will see the voting option on this page.&nbsp;Share the link or scan the QR code below
              so anyone can vote.
            </p>
          </div>
        </div>

        <div className="w-full min-w-0 flex flex-nowrap justify-center items-start gap-[10px]">
          <div
            className="min-w-0 flex-1 py-1 px-3.5 rounded-full flex items-center min-h-0 overflow-hidden"
            style={{
              background: 'var(--UI-Primary, #1D1D1F)',
              outline: '1px solid var(--Text-Primary, #FCFFFF)',
              outlineOffset: -1
            }}
          >
            <span
              className="truncate w-full text-lg leading-7 tracking-[1.08px] font-normal text-[var(--Text-Primary,#FCFFFF)] min-w-0 font-[Andale_Mono,andale_mono,ui-monospace,monospace]"
              title={voteUrl}
            >
              {voteUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 py-2 px-3 rounded-[2px] inline-flex justify-center items-center gap-2 font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)]"
            style={{
              background: 'var(--UI-Primary, #1D1D1F)',
              outline: '1px solid var(--Text-Primary, #FCFFFF)',
              outlineOffset: -1
            }}
          >
            <Copy className="w-4 h-4 shrink-0 text-[var(--Text-Primary,#FCFFFF)]" aria-hidden />
            Copy
          </button>
        </div>

        <div className="shrink-0 rounded-sm bg-white p-2">
          <QRCodeSVG value={voteUrl} size={120} className="block h-[120px] w-[120px]" />
        </div>
      </div>
    </div>
  );
}
