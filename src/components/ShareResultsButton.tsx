import React, { useState } from 'react';
import { ShareIcon } from '@/components/icons';
import ShareResultsDialog from '@/components/share/ShareResultsDialog';
import type { SharePick, ShareTeamScore } from '@/utils/shareContent';

interface ShareResultsButtonProps {
  draftTitle: string;
  teamScores: ShareTeamScore[];
  picks: SharePick[];
  draftId: string;
  isPublicView?: boolean;
  votingOpen?: boolean;
}

const ShareResultsButton: React.FC<ShareResultsButtonProps> = ({
  draftTitle,
  teamScores,
  picks,
  draftId,
  votingOpen = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={teamScores.length === 0}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--UI-Primary-Hover, #2C2B2D)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--UI-Primary, #1D1D1F)';
        }}
        className="w-full md:w-auto"
        style={{
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingTop: '12px',
          paddingBottom: '12px',
          borderRadius: '2px',
          outline: '1px var(--Button-Stroke, #666469) solid',
          outlineOffset: '-1px',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          display: 'inline-flex',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: 'var(--UI-Primary, #1D1D1F)',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'inline-flex',
          }}
        >
          <ShareIcon className="" style={{ width: '24px', height: '24px', color: '#FCFFFF' }} />
        </div>
        <div
          style={{
            textAlign: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--Text-Primary, #FCFFFF)',
            fontSize: '16px',
            fontFamily: 'Brockmann',
            fontWeight: '600',
            lineHeight: '24px',
            letterSpacing: '0.32px',
            wordWrap: 'break-word',
          }}
        >
          Share Results
        </div>
      </button>

      <ShareResultsDialog
        isOpen={open}
        onOpenChange={setOpen}
        draftTitle={draftTitle}
        draftId={draftId}
        picks={picks}
        teamScores={teamScores}
        votingOpen={votingOpen}
      />
    </>
  );
};

export default ShareResultsButton;
