
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
  const [restoredDraftId, setRestoredDraftId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!draftState && !urlDraftId) {
      navigate('/');
    }
  }, [draftState, urlDraftId, navigate]);

  // Try to find existing draft by theme and option if no existingDraftId is provided
  useEffect(() => {
    const findExistingDraft = async () => {
      // Skip if we already have an existingDraftId, or if it's multiplayer, or if we've already loaded
      if (draftState?.existingDraftId || draftState?.isMultiplayer || hasLoadedDraft.current || !draftState) return;
      
      // Only try to restore for authenticated users or guests with a session
      if (!user && !guestSession) return;

      hasLoadedDraft.current = true;
      setLoadingExistingDraft(true);
      
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Build query to find matching draft
        let query = supabase
          .from('drafts')
          .select('id')
          .eq('theme', draftState.theme)
          .eq('option', draftState.option)
          .eq('is_multiplayer', false)
          .order('created_at', { ascending: false })
          .limit(1);

        // Filter by user or guest session
        if (user) {
          query = query.eq('user_id', user.id);
        } else if (guestSession) {
          query = query.eq('guest_session_id', guestSession.id);
        }

        const { data: drafts, error } = await query;

        if (error) {
          console.error('Error finding existing draft:', error);
          return;
        }

        if (drafts && drafts.length > 0) {
          const foundDraftId = drafts[0].id;
          console.log('Found existing draft:', foundDraftId);
          setRestoredDraftId(foundDraftId);
          
          // Load the draft and picks
          const { draft, picks } = await getDraftWithPicks(foundDraftId);
          console.log('Draft loaded:', draft);
          console.log('Picks loaded:', picks);
          
          if (picks && picks.length > 0) {
            setExistingPicks(picks);
          }
        }
      } catch (error) {
        console.error('Error finding existing draft:', error);
      } finally {
        setLoadingExistingDraft(false);
      }
    };

    findExistingDraft();
  }, [draftState, user, guestSession, getDraftWithPicks]);

  // Load existing draft data if existingDraftId is provided
  useEffect(() => {
    const loadExistingDraft = async () => {
      const draftIdToLoad = draftState?.existingDraftId || restoredDraftId;
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

    if ((draftState?.existingDraftId || restoredDraftId) && !hasLoadedDraft.current && !draftState?.isMultiplayer) {
      loadExistingDraft();
    }
  }, [draftState?.existingDraftId, restoredDraftId, draftState?.isMultiplayer, getDraftWithPicks]);

  // Show loading state while loading existing draft (only for non-multiplayer drafts)
  if (loading || (loadingExistingDraft && !draftState?.isMultiplayer)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div className="text-text-primary text-xl">
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
          draftState={{
            ...draftState,
            existingDraftId: draftState.existingDraftId || restoredDraftId || undefined
          }} 
          existingPicks={existingPicks}
        />
      </div>
    </div>
  );
};

export default Index;
