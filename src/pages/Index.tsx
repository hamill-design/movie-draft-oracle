
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DraftHeader from '@/components/DraftHeader';
import DraftInterface from '@/components/DraftInterface';
import { MultiplayerDraftInterface } from '@/components/MultiplayerDraftInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { Participant, normalizeParticipants } from '@/types/participant';

interface DraftState {
  theme: string;
  option: string;
  participants: string[] | Participant[];
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
  const { participantId } = useCurrentUser();
  const { getDraftWithPicks } = useDraftOperations();
  const draftState = location.state as DraftState;
  const hasLoadedDraft = useRef(false);
  
  const [loadingExistingDraft, setLoadingExistingDraft] = useState(false);
  const [existingPicks, setExistingPicks] = useState<any[]>([]);
  const [loadedDraftState, setLoadedDraftState] = useState<DraftState | null>(null);
  const [specDraftName, setSpecDraftName] = useState<string | null>(null);
  
  // Use loaded draft state if available, otherwise use location state
  const finalDraftState = loadedDraftState || draftState;

  // Scroll to top when a new draft is started (when draftState changes)
  useEffect(() => {
    if (finalDraftState) {
      window.scrollTo(0, 0);
    }
  }, [finalDraftState]);
  
  useEffect(() => {
    if (!finalDraftState && !urlDraftId) {
      navigate('/');
    }
  }, [finalDraftState, urlDraftId, navigate]);

  // Load draft from URL if urlDraftId exists and we don't have draftState
  useEffect(() => {
    const loadDraftFromUrl = async () => {
      if (!urlDraftId || hasLoadedDraft.current || draftState) return;
      
      // Wait for participantId to be available before loading
      if (!participantId) return;
      
      hasLoadedDraft.current = true;
      setLoadingExistingDraft(true);
      
      try {
        console.log('Loading draft from URL:', urlDraftId);
        
        // Try using RPC function first (works for both local and multiplayer drafts)
        const rpcResult = await supabase.rpc('load_draft_unified', {
          p_draft_id: urlDraftId,
          p_participant_id: participantId
        });
        
        if (!rpcResult.error && rpcResult.data && rpcResult.data.length > 0) {
          // RPC function succeeded - handle multiplayer draft
          const draftData = rpcResult.data[0];
          
          // Check if it's a multiplayer draft
          if (draftData.draft_is_multiplayer) {
            // For multiplayer drafts, let MultiplayerDraftInterface handle loading
            // Just set the state to indicate it's multiplayer
            const reconstructedState: DraftState = {
              theme: draftData.draft_theme,
              option: draftData.draft_option,
              participants: draftData.draft_participants || [],
              categories: draftData.draft_categories || [],
              existingDraftId: draftData.draft_id,
              isMultiplayer: true,
            };
            setLoadedDraftState(reconstructedState);
            setLoadingExistingDraft(false);
            return;
          }
          
          // For local drafts, reconstruct state from RPC response
          const normalizedParticipants = normalizeParticipants(draftData.draft_participants || []);
          const reconstructedState: DraftState = {
            theme: draftData.draft_theme,
            option: draftData.draft_option,
            participants: normalizedParticipants,
            categories: draftData.draft_categories || [],
            existingDraftId: draftData.draft_id,
            isMultiplayer: false,
          };
          
          setLoadedDraftState(reconstructedState);
          
          // Set picks if available
          const picksArray = Array.isArray(draftData.picks_data) ? draftData.picks_data : [];
          if (picksArray.length > 0) {
            setExistingPicks(picksArray);
          }
          
          // Fetch spec draft name if theme is spec-draft
          if (draftData.draft_theme === 'spec-draft' && draftData.draft_option) {
            try {
              const { data: specDraftData, error: specDraftError } = await supabase
                .from('spec_drafts')
                .select('name')
                .eq('id', draftData.draft_option)
                .single();

              if (!specDraftError && specDraftData) {
                setSpecDraftName(specDraftData.name);
              }
            } catch (err) {
              console.error('Error fetching spec draft name:', err);
            }
          }
        } else {
          // RPC function failed, fall back to direct query (for backward compatibility)
          const { draft, picks } = await getDraftWithPicks(urlDraftId);
          
          console.log('Draft loaded from URL (fallback):', draft);
          console.log('Picks loaded from URL (fallback):', picks);
          
          // Reconstruct draft state from database
          const normalizedParticipants = normalizeParticipants(draft.participants || []);
          const reconstructedState: DraftState = {
            theme: draft.theme,
            option: draft.option,
            participants: normalizedParticipants,
            categories: draft.categories,
            existingDraftId: draft.id,
            isMultiplayer: draft.is_multiplayer || false,
          };
          
          setLoadedDraftState(reconstructedState);
          
          // Fetch spec draft name if theme is spec-draft
          if (draft.theme === 'spec-draft' && draft.option) {
            try {
              const { data: specDraftData, error: specDraftError } = await supabase
                .from('spec_drafts')
                .select('name')
                .eq('id', draft.option)
                .single();

              if (!specDraftError && specDraftData) {
                setSpecDraftName(specDraftData.name);
              }
            } catch (err) {
              console.error('Error fetching spec draft name:', err);
            }
          }
          
          if (picks && picks.length > 0) {
            setExistingPicks(picks);
          }
        }
      } catch (error) {
        console.error('Error loading draft from URL:', error);
        // If draft doesn't exist or can't be accessed, redirect home
        navigate('/');
      } finally {
        setLoadingExistingDraft(false);
      }
    };

    loadDraftFromUrl();
  }, [urlDraftId, draftState, participantId, getDraftWithPicks, navigate]);

  // Load existing draft data if existingDraftId is provided (from location state)
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

  // Fetch spec draft name when draftState changes (for location state drafts)
  // IMPORTANT: This must be before any early returns to maintain hook order
  useEffect(() => {
    const fetchSpecDraftName = async () => {
      if (finalDraftState?.theme === 'spec-draft' && finalDraftState.option && !specDraftName) {
        try {
          const { data, error } = await supabase
            .from('spec_drafts')
            .select('name')
            .eq('id', finalDraftState.option)
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
  }, [finalDraftState?.theme, finalDraftState?.option, specDraftName]);

  // Generate page title based on draft type
  const getPageTitle = () => {
    if (!finalDraftState) return 'Movie Drafter - Draft';
    
    if (finalDraftState.theme === 'spec-draft' && specDraftName) {
      return `Movie Drafter - ${specDraftName} Draft`;
    }
    
    const themeLabels: Record<string, string> = {
      'spec-draft': 'Spec Draft',
      'year': `${finalDraftState.option || ''} Movies`,
      'people': `${finalDraftState.option || ''} Movies`,
    };
    
    const themeLabel = themeLabels[finalDraftState.theme] || 'Draft';
    return `Movie Drafter - ${themeLabel}`;
  };

  // Show loading state
  if (loading || loadingExistingDraft) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>
          {loadingExistingDraft ? 'Loading draft...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Don't render anything if no draft state and no URL draft ID
  if (!finalDraftState && !urlDraftId) {
    return null;
  }

  // Location state after create is { skipRemount: true } — not real draft data. Treat as usable only when we have theme or multiplayer + existingDraftId.
  const hasUsableDraftState =
    finalDraftState &&
    (finalDraftState.theme != null || (finalDraftState.isMultiplayer && finalDraftState.existingDraftId));

  // Render multiplayer interface only if this is actually a multiplayer draft
  // Always pass participantId so load-draft can run without waiting for child's guest session (fixes stuck loading for guests).
  if (finalDraftState?.isMultiplayer) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Index] Rendering MultiplayerDraftInterface via finalDraftState.isMultiplayer', { participantId: participantId ?? null, draftId: urlDraftId || finalDraftState?.existingDraftId });
    }
    return (
      <MultiplayerDraftInterface 
        draftId={urlDraftId || finalDraftState?.existingDraftId}
        initialData={!urlDraftId && !finalDraftState?.existingDraftId ? finalDraftState : undefined}
        participantId={participantId}
      />
    );
  }

  // When we have urlDraftId but no usable draft state (e.g. just navigated after create with state: { skipRemount: true }), render MultiplayerDraftInterface so it can call load_draft_unified.
  if (urlDraftId && !hasUsableDraftState) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Index] Rendering MultiplayerDraftInterface via urlDraftId (no usable draft state)', { participantId: participantId ?? null, urlDraftId });
    }
    return (
      <MultiplayerDraftInterface 
        draftId={urlDraftId}
        initialData={undefined}
        participantId={participantId}
      />
    );
  }

  // For multiplayer drafts, we don't need option/theme checks - MultiplayerDraftInterface handles it
  // Only check for local drafts
  if (finalDraftState && !finalDraftState.isMultiplayer) {
    // Ensure we have required properties before rendering local draft
    if (!finalDraftState.option || !finalDraftState.theme) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
          <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>Loading draft...</div>
        </div>
      );
    }
  }

  return (
    <>
      <Helmet>
        <title>{getPageTitle()}</title>
        <meta name="description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <link rel="canonical" href={`https://moviedrafter.com/draft${urlDraftId ? `/${urlDraftId}` : ''}`} />
        <meta property="og:title" content={getPageTitle()} />
        <meta property="og:description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <meta property="og:url" content={`https://moviedrafter.com/draft${urlDraftId ? `/${urlDraftId}` : ''}`} />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content={getPageTitle()} />
        <meta name="twitter:description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
      <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div className="container mx-auto px-4 py-8">
          <DraftHeader
            draftOption={finalDraftState.option}
            theme={finalDraftState.theme}
            currentPlayer={undefined} // Will be handled by DraftInterface
            isComplete={false} // Will be handled by DraftInterface
          />

          <DraftInterface 
            draftState={finalDraftState}
            existingPicks={existingPicks}
          />
        </div>
      </div>
    </>
  );
};

export default Index;
