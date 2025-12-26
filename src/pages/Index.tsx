
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
  const { user, loading, guestSession } = useAuth();
  const { getDraftWithPicks } = useDraftOperations();
  const draftState = location.state as DraftState;
  const hasLoadedDraft = useRef(false);
  
  const [loadingExistingDraft, setLoadingExistingDraft] = useState(false);
  const [existingPicks, setExistingPicks] = useState<any[]>([]);
  
  // Scroll to top when a new draft is started (when draftState changes)
  useEffect(() => {
    if (draftState) {
      window.scrollTo(0, 0);
    }
  }, [draftState]);
  
  useEffect(() => {
    if (!draftState && !urlDraftId) {
      navigate('/');
    }
  }, [draftState, urlDraftId, navigate]);

  // Load existing draft data if existingDraftId is provided
  // Note: We no longer auto-restore drafts by theme/option to ensure each new draft gets a unique ID
  useEffect(() => {
    const loadExistingDraft = async () => {
      const draftIdToLoad = draftState?.existingDraftId;
      if (!draftIdToLoad || hasLoadedDraft.current || draftState?.isMultiplayer) return;

      hasLoadedDraft.current = true;
      setLoadingExistingDraft(true);
      
      try {
        console.log('Loading existing draft:', draftIdToLoad);
        const { draft, picks } = await getDraftWithPicks(draftIdToLoad);
        
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

    if (draftState?.existingDraftId && !hasLoadedDraft.current && !draftState?.isMultiplayer) {
      loadExistingDraft();
    }
  }, [draftState?.existingDraftId, draftState?.isMultiplayer, getDraftWithPicks]);

  // Show loading state while loading existing draft (only for non-multiplayer drafts)
  if (loading || (loadingExistingDraft && !draftState?.isMultiplayer)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>
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
      />
    );
  }

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
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
