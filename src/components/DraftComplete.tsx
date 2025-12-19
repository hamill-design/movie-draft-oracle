
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface DraftCompleteProps {
  draftId?: string;
  draftData?: any;
  picks?: any[];
  isEnriching?: boolean;
}

const DraftComplete = ({ draftId: propDraftId, draftData: propDraftData, picks: propPicks, isEnriching }: DraftCompleteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Use prop draftId first, then fallback to location state
  const draftId = propDraftId || (location.state as any)?.existingDraftId;
  // Get draft data from props or location state
  const draftData = propDraftData || (location.state as any)?.draftData;
  const picks = propPicks || (location.state as any)?.picks;

  const handleViewScores = async () => {
    // Validate that we have a draftId
    if (!draftId) {
      console.error('Cannot navigate to final scores: draftId is missing', {
        propDraftId,
        locationState: location.state
      });
      
      toast({
        title: "Error",
        description: "Unable to view scores: Draft ID is missing. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }
    
    // If still enriching, wait a bit and check again
    if (isEnriching) {
      toast({
        title: "Calculating scores",
        description: "Please wait while we calculate movie scores...",
      });
      return;
    }
    
    // Validate that we have draft data
    const finalDraftData = draftData || {
      id: draftId,
      is_complete: true
    };
    
    const finalPicks = picks || [];
    
    console.log('Navigating to final scores with:', {
      draftId,
      hasDraftData: !!draftData,
      picksCount: finalPicks.length,
      firstPick: finalPicks[0],
      firstPickScore: (finalPicks[0] as any)?.calculated_score,
      firstPickHasData: !!(finalPicks[0] as any)?.rt_critics_score || !!(finalPicks[0] as any)?.imdb_rating,
      allPicksScores: finalPicks.map((p: any) => ({
        title: p.movie_title,
        calculated_score: p.calculated_score,
        rt_critics: p.rt_critics_score,
        imdb: p.imdb_rating,
        metacritic: p.metacritic_score
      }))
    });
    
    // Pass draft data via navigation state so FinalScores can use it without database query
    navigate(`/final-scores/${draftId}?public=true`, {
      state: { 
        draftData: finalDraftData,
        picks: finalPicks
      }
    });
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
            disabled={isEnriching}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-400 rounded-[2px] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-center text-primary-foreground text-sm font-brockmann-medium leading-5">
              {isEnriching ? 'Calculating Scores...' : 'View Final Scores'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftComplete;
