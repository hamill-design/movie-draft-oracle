
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
      <div 
        style={{
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '8px',
          display: 'inline-flex'
        }}
      >
        <div 
          style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex'
          }}
        >
          <div 
            style={{
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: '#FCFFFF',
              fontSize: '20px',
              fontFamily: 'Brockmann',
              fontWeight: 500,
              lineHeight: '28px'
            }}
          >
            Draft Complete!
          </div>
        </div>
        <div 
          style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex'
          }}
        >
          <div 
            style={{
              alignSelf: 'stretch',
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: '#BDC3C2',
              fontSize: '14px',
              fontFamily: 'Brockmann',
              fontWeight: 400,
              lineHeight: '20px'
            }}
          >
            All players have made their selections.
          </div>
        </div>
        <div 
          style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex',
            marginTop: '16px'
          }}
        >
          <Button
            onClick={handleViewScores}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-400 rounded-[2px] flex justify-center items-center gap-2"
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
