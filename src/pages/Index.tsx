
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DraftHeader from '@/components/DraftHeader';
import DraftInterface from '@/components/DraftInterface';
import { MultiplayerDraftInterface } from '@/components/MultiplayerDraftInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';

interface DraftState {
  theme: string;
  option: string;
  participants: string[];
  categories: string[];
  existingDraftId?: string;
  isMultiplayer?: boolean;
  inviteCode?: string;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { draftId: urlDraftId } = useParams();
  const { user, loading } = useAuth();
  const { getDraftWithPicks } = useDraftOperations();
  const draftState = location.state as DraftState;
  const hasLoadedDraft = useRef(false);
  
  const [loadingExistingDraft, setLoadingExistingDraft] = useState(false);
  const [existingPicks, setExistingPicks] = useState<any[]>([]);
  
  useEffect(() => {
    if (!draftState && !urlDraftId) {
      navigate('/');
    }
  }, [draftState, urlDraftId, navigate]);

  // Load existing draft data only for non-multiplayer drafts
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (!draftState?.existingDraftId || hasLoadedDraft.current || draftState.isMultiplayer) return;

      hasLoadedDraft.current = true;
      setLoadingExistingDraft(true);
      
      try {
        console.log('Loading existing draft:', draftState.existingDraftId);
        const { draft, picks } = await getDraftWithPicks(draftState.existingDraftId);
        
        console.log('Draft loaded:', draft);
        console.log('Picks loaded:', picks);
        
        if (picks && picks.length > 0) {
          setExistingPicks(picks);
        }
      } catch (error) {
        console.error('Error loading existing draft:', error);
        console.log('Continuing with new draft due to loading error');
      } finally {
        setLoadingExistingDraft(false);
      }
    };

    if (draftState?.existingDraftId && !hasLoadedDraft.current && !draftState.isMultiplayer) {
      loadExistingDraft();
    }
  }, [draftState?.existingDraftId, draftState?.isMultiplayer, getDraftWithPicks]);

  // Show loading state while loading existing draft (only for non-multiplayer drafts)
  if (loading || (loadingExistingDraft && !draftState?.isMultiplayer)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">
          {loadingExistingDraft ? 'Loading draft...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Don't render anything if no draft state and no URL draft ID
  if (!draftState && !urlDraftId) {
    return null;
  }

  // Render multiplayer interface if this is a multiplayer draft or if we have a URL draft ID
  if (draftState?.isMultiplayer || urlDraftId) {
    return (
      <MultiplayerDraftInterface 
        draftId={urlDraftId || draftState?.existingDraftId}
        initialData={!urlDraftId && !draftState?.existingDraftId ? draftState : undefined}
        initialDraftData={(location.state as any)?.initialDraftData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <DraftHeader
          draftOption={draftState.option}
          theme={draftState.theme}
          currentPlayer={undefined} // Will be handled by DraftInterface
          isComplete={false} // Will be handled by DraftInterface
        />

        <DraftInterface 
          draftState={draftState} 
          existingPicks={existingPicks}
        />
      </div>
    </div>
  );
};

export default Index;
