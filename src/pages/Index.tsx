
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DraftHeader from '@/components/DraftHeader';
import DraftInterface from '@/components/DraftInterface';
import { MultiplayerDraftInterface } from '@/components/MultiplayerDraftInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { supabase } from '@/integrations/supabase/client';

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
      
      hasLoadedDraft.current = true;
      setLoadingExistingDraft(true);
      
      try {
        console.log('Loading draft from URL:', urlDraftId);
        const { draft, picks } = await getDraftWithPicks(urlDraftId);
        
        console.log('Draft loaded from URL:', draft);
        console.log('Picks loaded from URL:', picks);
        
        // Reconstruct draft state from database
        const reconstructedState: DraftState = {
          theme: draft.theme,
          option: draft.option,
          participants: draft.participants,
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
      } catch (error) {
        console.error('Error loading draft from URL:', error);
        // If draft doesn't exist or can't be accessed, redirect home
        navigate('/');
      } finally {
        setLoadingExistingDraft(false);
      }
    };

    loadDraftFromUrl();
  }, [urlDraftId, draftState, getDraftWithPicks, navigate]);

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

  // Render multiplayer interface only if this is actually a multiplayer draft
  // If we have urlDraftId but no finalDraftState yet, we need to wait for it to load
  // to determine if it's multiplayer or not. But if draftState has isMultiplayer, use that.
  if (finalDraftState?.isMultiplayer) {
    return (
      <MultiplayerDraftInterface 
        draftId={urlDraftId || finalDraftState?.existingDraftId}
        initialData={!urlDraftId && !finalDraftState?.existingDraftId ? finalDraftState : undefined}
      />
    );
  }

  // If we're still loading and have urlDraftId, show loading state
  // (This handles the case where multiplayer draft is loading from URL)
  if (urlDraftId && !finalDraftState && loadingExistingDraft) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>Loading draft...</div>
      </div>
    );
  }

  // Ensure we have finalDraftState before rendering local draft
  if (!finalDraftState) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{getPageTitle()}</title>
        <meta name="description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <meta property="og:title" content={getPageTitle()} />
        <meta property="og:description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <meta property="og:url" content={`https://moviedrafter.com/draft${urlDraftId ? `/${urlDraftId}` : ''}`} />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg" />
        <meta name="twitter:title" content={getPageTitle()} />
        <meta name="twitter:description" content="Create and manage your movie draft. Pick your favorite films across different categories and compete with friends." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg" />
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
