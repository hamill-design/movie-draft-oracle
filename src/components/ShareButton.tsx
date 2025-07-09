import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShareModal from './ShareModal';

interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface ShareButtonProps {
  draftTitle: string;
  teamScores: TeamScore[];
  totalPicks: number;
}

const ShareButton: React.FC<ShareButtonProps> = ({ draftTitle, teamScores, totalPicks }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="gap-2"
      >
        <Share2 size={16} />
        Share Results
      </Button>

      <ShareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        draftTitle={draftTitle}
        teamScores={teamScores}
        totalPicks={totalPicks}
      />
    </>
  );
};

export default ShareButton;