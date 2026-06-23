
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DraftActorPortrait } from './DraftActorPortrait';
import { DraftPageHeaderSection } from '@/components/DraftPageHeaderSection';
import { DraftHeadingTitle } from '@/components/DraftHeadingTitle';
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
      <DraftPageHeaderSection>
        <DraftHeadingTitle
          option={draftOption}
          theme={theme}
          specDraftName={specDraftName}
        />
        {!isComplete && currentPlayer && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Crown className="text-yellow-400" size={20} />
            <p className="text-text-primary font-brockmann font-semibold">
              Current Pick: {currentPlayer.name} (#{currentPlayer.pick})
            </p>
          </div>
        )}
      </DraftPageHeaderSection>
    </>;
};

export default DraftHeader;
