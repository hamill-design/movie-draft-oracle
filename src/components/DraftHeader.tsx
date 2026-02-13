
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DraftActorPortrait } from './DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  const [specDraftName, setSpecDraftName] = useState<string | null>(null);

  // Fetch spec draft name if theme is spec-draft
  useEffect(() => {
    const fetchSpecDraftName = async () => {
      if (theme === 'spec-draft' && draftOption) {
        try {
          const { data, error } = await (supabase as any)
            .from('spec_drafts')
            .select('name')
            .eq('id', draftOption)
            .single();

          if (error) throw error;
          if (data) {
            setSpecDraftName(data.name);
          }
        } catch (err) {
          console.error('Error fetching spec draft name:', err);
        }
      }
    };

    fetchSpecDraftName();
  }, [theme, draftOption]);

  return <>
      {/* Header */}
      

      {/* Draft Info */}
      <div className="mb-6">
        <div className="p-6 rounded-[8px]">
          <div className="flex flex-col justify-center items-center gap-4 text-center">
            <span className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px]">
              NOW DRAFTING
            </span>
            <div 
              className="font-chaney font-normal text-center"
              style={{
                fontSize: 'clamp(32px, 4vw, 64px)',
                lineHeight: 'clamp(32px, 4vw, 64px)',
                maxWidth: '100%',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
              }}
            >
              <span className="text-greyscale-blue-100">
                {theme === 'spec-draft' 
                  ? (specDraftName || draftOption || '').toUpperCase()
                  : theme === 'people' 
                    ? getCleanActorName(draftOption || '').toUpperCase()
                    : (draftOption || '').toString()}
              </span>
              {theme !== 'spec-draft' && (
                <>
                  {' '}
                  <span className="text-purple-300">
                    MOVIES
                  </span>
                </>
              )}
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
