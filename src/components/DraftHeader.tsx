
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DraftActorPortrait } from './DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';

interface DraftHeaderProps {
  draftOption: string;
  theme?: string;
  currentPlayer?: {
    name: string;
    pick: number;
  };
  isComplete: boolean;
}

const DraftHeader = ({
  draftOption,
  theme,
  currentPlayer,
  isComplete
}: DraftHeaderProps) => {
  const navigate = useNavigate();

  return <>
      {/* Header */}
      

      {/* Draft Info */}
      <div className="mb-6">
        <div className="p-6">
          <div className="flex flex-col justify-center items-center gap-4 text-center">
            <span className="text-text-primary text-[32px] font-brockmann font-medium leading-[36px] tracking-[1.28px]">
              NOW DRAFTING
            </span>
            <div className="text-[64px] font-chaney font-normal leading-[64px] text-center">
              <span className="text-purple-500">
                {theme === 'people' ? getCleanActorName(draftOption).toUpperCase() + ' ' : draftOption.toString() + ' '}
              </span>
              <span className="text-text-primary">
                {theme === 'people' ? 'MOVIES' : 'MOVIES'}
              </span>
            </div>
            {!isComplete && currentPlayer && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Crown className="text-yellow-400" size={20} />
                <p className="text-text-primary font-brockmann font-semibold">
                  Current Pick: {currentPlayer.name} (#{currentPlayer.pick})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>;
};

export default DraftHeader;
