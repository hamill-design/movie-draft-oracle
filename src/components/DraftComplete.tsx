
import React from 'react';
import { Button } from '@/components/ui/button';
import { Film, Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const DraftComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract draft ID from the current state if available
  const draftState = location.state as any;
  const draftId = draftState?.existingDraftId;

  const handleViewScores = () => {
    if (draftId) {
      navigate(`/final-scores/${draftId}?public=true`);
    } else {
      // Fallback to home if no draft ID
      navigate('/');
    }
  };

  return (
    <div className="p-6 rounded-lg">
      <div className="w-full h-full flex flex-col justify-start items-start">
        <div className="self-stretch flex flex-col justify-start items-center gap-4">
          <div className="self-stretch flex flex-col justify-start items-start gap-2">
            <div className="self-stretch flex flex-col justify-start items-center">
              <div className="text-center flex flex-col justify-center text-foreground text-xl font-brockmann-medium leading-7">
                Draft Complete!
              </div>
            </div>
            <div className="self-stretch flex flex-col justify-start items-center">
              <div className="self-stretch text-center flex flex-col justify-center text-muted-foreground text-sm font-brockmann leading-5">
                All players have made their selections.
              </div>
            </div>
          </div>
          <Button
            onClick={handleViewScores}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-sm flex justify-center items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-center text-primary-foreground text-sm font-brockmann-medium leading-5">
              View Final Scores
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftComplete;
