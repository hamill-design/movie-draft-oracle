
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const { user, loading } = useAuth();
  const { getDraftWithPicks } = useDraftOperations();
  const draftState = location.state as DraftState;
  const hasLoadedDraft = useRef(false);
  
  const [loadingExistingDraft, setLoadingExistingDraft] = useState(false);
  const [existingPicks, setExistingPicks] = useState<any[]>([]);
  
  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!draftState) {
      navigate('/');
    }
  }, [draftState, navigate]);

  // Load existing draft data if editing an existing draft
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (!draftState?.existingDraftId || !user || hasLoadedDraft.current) return;

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

    if (draftState?.existingDraftId && user && !hasLoadedDraft.current) {
      loadExistingDraft();
    }
  }, [draftState?.existingDraftId, user, getDraftWithPicks]);

  // Show loading state while checking auth or loading existing draft
  if (loading || loadingExistingDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">
          {loadingExistingDraft ? 'Loading draft...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user || !draftState) {
    return null;
  }

  // Render multiplayer interface if this is a multiplayer draft
  if (draftState.isMultiplayer) {
    return (
      <MultiplayerDraftInterface 
        draftId={draftState.existingDraftId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <DraftHeader
          draftOption={draftState.option}
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
