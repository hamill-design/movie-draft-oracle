
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DraftActorPortrait } from './DraftActorPortrait';

interface DraftHeaderProps {
  draftOption: string;
  theme?: string;
  currentPlayer?: {
    name: string;
    pick: number;
  };
  isComplete: boolean;
}

const DraftHeader = ({ draftOption, theme, currentPlayer, isComplete }: DraftHeaderProps) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          size="sm"
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold text-white">Movie Draft</h1>
      </div>

      {/* Draft Info */}
      <Card className="bg-gray-800 border-gray-600 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-3">
              {theme === 'people' && (
                <DraftActorPortrait 
                  actorName={draftOption}
                  size="md"
                />
              )}
              <p className="text-gray-300">
                Theme: <span className="text-yellow-400 font-bold">
                  {theme === 'people' ? draftOption : draftOption}
                </span>
              </p>
            </div>
            {!isComplete && currentPlayer && (
              <div className="flex items-center gap-2">
                <Crown className="text-yellow-400" size={20} />
                <p className="text-white font-bold">
                  Current Pick: {currentPlayer.name} (#{currentPlayer.pick})
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default DraftHeader;
