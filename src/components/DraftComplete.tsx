
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="bg-gray-800 border-gray-600">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <Film className="mx-auto text-yellow-400" size={64} />
          <h2 className="text-2xl font-bold text-white">Draft Complete!</h2>
          <p className="text-gray-300">All players have made their selections.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleViewScores}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              <Trophy className="mr-2" size={16} />
              View Final Scores
            </Button>
            
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Start New Draft
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DraftComplete;
