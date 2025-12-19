import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Clock, Film, Trophy } from 'lucide-react';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import { PersonIcon } from '@/components/icons/PersonIcon';
import MovieSearch from '@/components/MovieSearch';
import EnhancedCategorySelection from '@/components/EnhancedCategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftBoard from '@/components/DraftBoard';
import { Skeleton } from '@/components/ui/skeleton';

import { getCleanActorName } from '@/lib/utils';

interface MultiplayerDraftInterfaceProps {
  draftId?: string;
  initialData?: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    isHost?: boolean;
  };
}

export const MultiplayerDraftInterface = ({
  draftId,
  initialData
}: MultiplayerDraftInterfaceProps) => {
  const {
    participantId
  } = useCurrentUser();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const {
    draft,
    participants,
    picks,
    loading,
    isMyTurn,
    isConnected,
    createMultiplayerDraft,
    makePick,
    startDraft,
    manualRefresh
  } = useMultiplayerDraft(draftId);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [specDraftName, setSpecDraftName] = useState<string | null>(null);

  // Fetch spec draft name if theme is spec-draft
  useEffect(() => {
    const fetchSpecDraftName = async () => {
      if (draft?.theme === 'spec-draft' && draft.option) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await (supabase as any)
            .from('spec_drafts')
            .select('name')
            .eq('id', draft.option)
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

    if (draft?.theme === 'spec-draft') {
      fetchSpecDraftName();
    }
  }, [draft?.theme, draft?.option]);

  // Get base category for movie search
  const getBaseCategory = () => {
    if (!draft) return '';
    if (draft.theme === 'spec-draft') {
      return 'spec-draft';
    }
    if (draft.theme === 'people') {
      return 'person';
    }
    return 'popular';
  };

  // For theme-based drafts, pass the theme option (year, person name, or spec draft ID) as the constraint
  // This will fetch ALL movies for that year/person/spec draft
  const themeConstraint = draft?.theme === 'year' || draft?.theme === 'people' || draft?.theme === 'spec-draft' 
    ? draft.option 
    : '';
  const {
    movies,
    loading: moviesLoading
  } = useMovies(getBaseCategory(), themeConstraint);

  // Create draft if this is a new multiplayer draft
  useEffect(() => {
    if (initialData && !draftId && participantId) {
      const createDraft = async () => {
        try {
          const newDraftId = await createMultiplayerDraft({
            title: initialData.option,
            theme: initialData.theme,
            option: initialData.option,
            categories: initialData.categories,
            participantEmails: initialData.participants
          });

          // Navigate to the draft page with the multiplayer data
          navigate(`/draft/${newDraftId}`, {
            replace: true
          });
        } catch (error) {
          console.error('Failed to create draft:', error);
          toast({
            title: "Error",
            description: "Failed to create multiplayer draft",
            variant: "destructive"
          });
        }
      };
      createDraft();
    }
  }, [initialData, draftId, participantId, createMultiplayerDraft, navigate, toast]);

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = async () => {
    if (!selectedMovie || !selectedCategory) {
      return;
    }
    
    // Double-check it's the user's turn before making the pick
    if (!isMyTurn) {
      toast({
        title: "Not Your Turn",
        description: "It's not your turn to make a pick. Please wait for your turn.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await makePick(selectedMovie.id, selectedMovie.title, selectedMovie.releaseDate ? new Date(selectedMovie.releaseDate).getFullYear() : new Date().getFullYear(), selectedMovie.genre_names?.[0] || 'Unknown', selectedCategory, selectedMovie.poster_path);
      setSelectedMovie(null);
      setSelectedCategory('');
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to make pick in interface:', error);
    }
  };

  const copyInviteCode = async () => {
    if (!draft?.invite_code) return;
    try {
      await navigator.clipboard.writeText(draft.invite_code);
      setCopySuccess(true);
      toast({
        title: "Invite Code Copied",
        description: "Share this code with friends to join the draft"
      });
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const getCurrentTurnPlayer = () => {
    if (!draft || !participants.length) return null;

    // Use unified field if available, fallback to legacy field
    const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
    if (!currentTurnId) return null;
    return participants.find(p => {
      const participantId = p.user_id || p.guest_participant_id;
      return participantId === currentTurnId;
    });
  };

  // Check if current user is the host
  const isHost = useMemo(() => {
    if (!participants.length || !participantId) return false;
    return participants.some(p => {
      if (p.is_host) {
        const pId = p.user_id || p.guest_participant_id;
        return pId === participantId;
      }
      return false;
    });
  }, [participants, participantId]);

  // Check if draft has been started (has turn order)
  const draftHasStarted = draft?.turn_order && draft.turn_order.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!participantId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription style={{color: 'var(--Text-Primary, #FCFFFF)'}}>
              Loading your session to participate in the draft...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Draft Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The draft you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTurnPlayer = getCurrentTurnPlayer();
  const isComplete = draft.is_complete;

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'
    }}>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="p-6 rounded-[8px]">
            <div className="flex flex-col justify-center items-center gap-4 text-center">
              <span className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px]">
                NOW DRAFTING
              </span>
              <div 
                className="font-chaney font-normal text-center break-words"
                style={{
                  fontSize: '64px',
                  lineHeight: '64px',
                  maxWidth: '100%'
                }}
              >
                <span className="text-greyscale-blue-100">
                  {draft.theme === 'spec-draft' 
                    ? (specDraftName || draft.option).toUpperCase()
                    : draft.theme === 'people' 
                      ? getCleanActorName(draft.option).toUpperCase() + ' '
                      : draft.option.toString() + ' '}
                </span>
                {draft.theme !== 'spec-draft' && (
                  <span className="text-purple-300">
                    MOVIES
                  </span>
                )}
              </div>
              
            </div>
          </div>
        </div>

        {/* Status and Participants */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 24px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex'}}>
              <div style={{width: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex'}}>
                <Clock size={24} color="#907AFF" />
              </div>
              <div style={{
                flex: '1 1 0', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '20px', 
                fontFamily: 'Brockmann', 
                fontWeight: '500', 
                lineHeight: '28px', 
                wordWrap: 'break-word'
              }}>Draft Status</div>
            </div>
            
            {isComplete ? (
              <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Primary, #FCFFFF)', 
                    fontSize: '16px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '600', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>Draft Complete</div>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Light-grey, #BDC3C2)', 
                    fontSize: '14px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '400', 
                    lineHeight: '20px', 
                    wordWrap: 'break-word'
                  }}>All picks have been made!</div>
                </div>
              </>
            ) : (
              <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Pick Number:</div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Primary, #FCFFFF)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '500', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>{draft.current_pick_number}</div>
                    </div>
                  </div>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Current Turn:</div>
                    </div>
                    <div style={{
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '14px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: '500', 
                      lineHeight: '20px', 
                      wordWrap: 'break-word'
                    }}>{currentTurnPlayer?.participant_name || 'Unknown'}</div>
                  </div>
                </div>
                {!isMyTurn && draftHasStarted && (
                  <div style={{
                    width: '100%', 
                    height: '100%', 
                    paddingTop: '22px', 
                    paddingBottom: '24px', 
                    paddingLeft: '24px', 
                    paddingRight: '24px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '8px', 
                    outline: '1px var(--Item-Stroke, #49474B) solid', 
                    outlineOffset: '-1px', 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '12px', 
                      display: 'flex'
                    }}>
                      <div style={{
                        width: '24px', 
                        padding: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px', 
                        display: 'flex'
                      }}>
                        <Clock size={20} color="#BDC3C2" />
                      </div>
                      <div style={{
                        alignSelf: 'stretch', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: '4px', 
                        display: 'flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Primary, #FCFFFF)', 
                          fontSize: '16px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '600', 
                          lineHeight: '24px', 
                          letterSpacing: '0.32px', 
                          wordWrap: 'break-word'
                        }}>
                          Waiting for {currentTurnPlayer?.participant_name}
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Light-grey, #BDC3C2)', 
                          fontSize: '14px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '20px', 
                          wordWrap: 'break-word'
                        }}>
                          It's their turn to make a pick
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isMyTurn && (
                  <div style={{width: '100%', height: '100%', padding: '24px', background: 'var(--Purple-800, #25015E)', borderRadius: '8px', outline: '3px var(--Purple-500, #680AFF) solid', outlineOffset: '-3px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '12px', display: 'flex'}}>
                      <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex'}}>
                        <Film size={24} color="#FFD60A" />
                      </div>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '3px', display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '16px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', letterSpacing: '0.32px', wordWrap: 'break-word'}}>It's Your Turn!</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Make your next pick to your movie roster</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Unified participants container with background treatment */}
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            {/* Join Code section */}
            <div style={{
              alignSelf: 'stretch', 
              flexDirection: 'column',
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              gap: '16px',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                display: 'inline-flex', 
                flexWrap: 'wrap'
              }}>
                <div style={{
                  minWidth: '120px', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #FCFFFF)', 
                  fontSize: '24px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '700', 
                  lineHeight: '24px', 
                  letterSpacing: '0.24px', 
                  wordWrap: 'break-word'
                }}>
                  Join Code
                </div>
              </div>
              {draft.invite_code && <div style={{
                alignSelf: 'flex-end',
                flexDirection: 'row', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                gap: '8px', 
                display: 'inline-flex'
              }}>
                  <div style={{
                    paddingLeft: '14px', 
                    paddingRight: '14px', 
                    paddingTop: '4px', 
                    paddingBottom: '4px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '9999px', 
                    outline: '1px var(--Text-Primary, #FCFFFF) solid', 
                    outlineOffset: '-1px', 
                    justifyContent: 'flex-start', 
                    alignItems: 'center', 
                    display: 'flex'
                  }}>
                    <div style={{
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '18px', 
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', 
                      fontWeight: '400', 
                      lineHeight: '28px', 
                      letterSpacing: '1.08px', 
                      wordWrap: 'break-word'
                    }}>
                      {draft.invite_code}
                    </div>
                  </div>
                  <button 
                    onClick={copyInviteCode}
                    style={{
                      paddingLeft: '12px', 
                      paddingRight: '12px', 
                      paddingTop: '8px', 
                      paddingBottom: '8px', 
                      background: 'var(--UI-Primary, #1D1D1F)', 
                      borderRadius: '2px', 
                      outline: '1px var(--Text-Primary, #FCFFFF) solid', 
                      outlineOffset: '-1px', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '8px', 
                      display: 'flex',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    <div style={{
                      width: '16px', 
                      height: '16px', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '10px', 
                      display: 'inline-flex'
                    }}>
                      {copySuccess ? <Check size={16} color="#FCFFFF" /> : <Copy size={16} color="#FCFFFF" />}
                    </div>
                    <div style={{
                      textAlign: 'center', 
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '14px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: '500', 
                      lineHeight: '20px', 
                      wordWrap: 'break-word'
                    }}>
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </div>
                  </button>
              </div>}
            </div>
            
            {/* Participants section */}
            <div style={{
              alignSelf: 'stretch', 
              flexDirection: 'column', 
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              gap: '16px', 
              display: 'flex'
            }}>
              <div style={{
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                gap: '8px', 
                display: 'inline-flex'
              }}>
                <div style={{
                  width: '24px', 
                  height: '24px', 
                  padding: '2px', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '10px', 
                  display: 'inline-flex',
                  color: 'var(--Text-Purple, #907AFF)'
                }}>
                  <MultiPersonIcon className="w-6 h-6" />
                </div>
                <div style={{
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #FCFFFF)', 
                  fontSize: '20px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '500', 
                  lineHeight: '28px', 
                  wordWrap: 'break-word'
                }}>
                  Participants
                </div>
              </div>
              
              {/* Participants list with proper gap */}
              <div style={{
                alignSelf: 'stretch', 
                flexDirection: 'column', 
                justifyContent: 'flex-start', 
                alignItems: 'flex-start', 
                gap: '8px', 
                display: 'flex'
              }}>
                {participants.map(participant => {
                  const pId = participant.user_id || participant.guest_participant_id;
                  const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
                  const isCurrentTurn = pId === currentTurnId;
                  return (
                    <div key={participant.id} style={{
                      alignSelf: 'stretch', 
                      paddingTop: '12px', 
                      paddingBottom: '12px', 
                      paddingLeft: '16px', 
                      paddingRight: '12px', 
                      background: 'var(--UI-Primary, #1D1D1F)', 
                      borderRadius: '2px', 
                      outline: '0.50px var(--Item-Stroke, #49474B) solid', 
                      outlineOffset: '-0.50px', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '8px', 
                      display: 'inline-flex'
                    }}>
                      <div style={{
                        flex: '1 1 0', 
                        paddingBottom: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'flex-start', 
                        gap: '4px', 
                        display: 'inline-flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            flex: '1 1 0', 
                            flexDirection: 'column', 
                            justifyContent: 'flex-start', 
                            alignItems: 'flex-start', 
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              justifyContent: 'center', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              color: 'var(--Text-Primary, #FCFFFF)', 
                              fontSize: '16px', 
                              fontFamily: 'Brockmann', 
                              fontWeight: '600', 
                              lineHeight: '24px', 
                              letterSpacing: '0.32px', 
                              wordWrap: 'break-word'
                            }}>
                              {participant.participant_name}
                            </div>
                          </div>
                          <div style={{
                            justifyContent: 'flex-start', 
                            alignItems: 'center', 
                            gap: '4px', 
                            display: 'flex'
                          }}>
                            {participant.is_host && <div style={{
                              paddingLeft: '12px', 
                              paddingRight: '12px', 
                              paddingTop: '4px', 
                              paddingBottom: '4px', 
                              background: 'var(--Purple-100, #EDEBFF)', 
                              borderRadius: '9999px', 
                              outline: '0.50px var(--Purple-800, #25015E) solid', 
                              outlineOffset: '-0.50px', 
                              justifyContent: 'flex-start', 
                              alignItems: 'center', 
                              display: 'flex'
                            }}>
                              <div style={{
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: 'var(--Purple-900, #100029)', 
                                fontSize: '12px', 
                                fontFamily: 'Brockmann', 
                                fontWeight: '600', 
                                lineHeight: '16px', 
                                wordWrap: 'break-word'
                              }}>
                                Host
                              </div>
                            </div>}
                            {isCurrentTurn && !isComplete && draftHasStarted && <div style={{
                              paddingLeft: '12px', 
                              paddingRight: '12px', 
                              paddingTop: '4px', 
                              paddingBottom: '4px', 
                              background: 'var(--Brand-Primary, #7142FF)', 
                              borderRadius: '9999px', 
                              justifyContent: 'flex-start', 
                              alignItems: 'center', 
                              display: 'flex'
                            }}>
                              <div style={{
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: 'var(--Text-Primary, #FCFFFF)', 
                                fontSize: '12px', 
                                fontFamily: 'Brockmann', 
                                fontWeight: '600', 
                                lineHeight: '16px', 
                                wordWrap: 'break-word'
                              }}>
                                Current Turn
                              </div>
                            </div>}
                          </div>
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          justifyContent: 'flex-start', 
                          alignItems: 'flex-start', 
                          gap: '4px', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: 'var(--Teal-500, #0AFFBE)', 
                            fontSize: '12px', 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '16px', 
                            wordWrap: 'break-word'
                          }}>
                            {participant.status === 'joined' ? 'Joined' : participant.status}
                          </div>
                          {participant.email && <div style={{
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: 'var(--Text-Light-grey, #BDC3C2)', 
                            fontSize: '12px', 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '16px', 
                            wordWrap: 'break-word'
                          }}>
                            {participant.email}
                          </div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Start Draft Button - Show only to host when conditions are met */}
        {!draftHasStarted && participants.length >= 2 && !isComplete && isHost && <div style={{width: '100%', height: '100%', padding: '24px', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Everybody Ready?</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>{participants.length} players have joined. Click below to randomize turn order and start the draft!</div>
                </div>
              </div>
              <div 
                onClick={() => startDraft(draft.id)}
                onMouseEnter={(e) => e.currentTarget.style.background = '#794DFF'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--Purple-500, #680AFF)'}
                style={{paddingLeft: '32px', paddingRight: '32px', paddingTop: '16px', paddingBottom: '16px', background: 'var(--Purple-500, #680AFF)', borderRadius: '2px', justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer', transition: 'background 0.2s ease'}}
              >
                <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '18px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', wordWrap: 'break-word'}}>
                  {loading ? 'Starting...' : 'Start Draft'}
                </div>
              </div>
            </div>
          </div>}

        {/* Waiting for Players - Show when not enough players */}
        {!draftHasStarted && participants.length < 2 && <div style={{width: '100%', height: '100%', padding: '24px', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex', color: '#FCFFFF'}}>
                <PersonIcon className="w-6 h-6" />
              </div>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Waiting For Players</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Need at least 2 players to start the draft. Share the invite code above!</div>
                </div>
              </div>
            </div>
          </div>}

        {/* Draft Content */}
        <div className="space-y-6">
          {/* Draft Board */}
          <div>
            <DraftBoard picks={picks.map(pick => ({
            playerId: pick.player_id,
            playerName: pick.player_name,
            movie: {
              id: pick.movie_id,
              title: pick.movie_title,
              year: pick.movie_year,
              poster_path: pick.poster_path
            },
            category: pick.category
          }))} players={(() => {
            // Sort participants by created_at to match database player_id calculation (ORDER BY created_at ASC)
            const sortedParticipants = [...participants].sort((a, b) => {
              const aTime = a.created_at || a.joined_at || '';
              const bTime = b.created_at || b.joined_at || '';
              if (!aTime && !bTime) return 0;
              if (!aTime) return 1;
              if (!bTime) return -1;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            });
            return sortedParticipants.map((p, index) => ({
              id: index + 1,
              name: p.participant_name
            }));
          })()} categories={draft.categories} theme={draft.theme} draftOption={getCleanActorName(draft.option)} currentPlayer={currentTurnPlayer ? (() => {
            const sortedParticipants = [...participants].sort((a, b) => {
              const aTime = a.created_at || a.joined_at || '';
              const bTime = b.created_at || b.joined_at || '';
              if (!aTime && !bTime) return 0;
              if (!aTime) return 1;
              if (!bTime) return -1;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            });
            return {
              id: sortedParticipants.findIndex(p => (p.user_id || p.guest_participant_id) === (currentTurnPlayer.user_id || currentTurnPlayer.guest_participant_id)) + 1,
              name: currentTurnPlayer.participant_name
            };
          })() : undefined} />
          </div>

          {/* View Final Scores Button - Show when draft is complete */}
          {isComplete && (
            <div className="flex justify-center">
              <div 
                onClick={() => navigate(`/final-scores/${draft.id}?public=true`)}
                onMouseEnter={(e) => e.currentTarget.style.background = '#794DFF'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--Purple-500, #680AFF)'}
                style={{
                  paddingLeft: '24px', 
                  paddingRight: '24px', 
                  paddingTop: '12px', 
                  paddingBottom: '12px', 
                  background: 'var(--Purple-500, #680AFF)', 
                  borderRadius: '2px', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  display: 'inline-flex', 
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{
                  textAlign: 'center', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--UI-Primary, white)', 
                  fontSize: '16px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '600', 
                  lineHeight: '24px', 
                  wordWrap: 'break-word'
                }}>
                  <Trophy size={20} color="#FFD60A" />
                  View Final Scores
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-6">
            {!isComplete && isMyTurn && <>
              <MovieSearch theme={draft.theme} option={getCleanActorName(draft.option)} searchQuery={searchQuery} onSearchChange={setSearchQuery} movies={movies} loading={moviesLoading} onMovieSelect={handleMovieSelect} selectedMovie={selectedMovie} themeParameter={themeConstraint} />

              <EnhancedCategorySelection 
                selectedMovie={selectedMovie} 
                categories={draft.categories} 
                selectedCategory={selectedCategory} 
                onCategorySelect={handleCategorySelect} 
                picks={picks.map(pick => ({
                  playerId: participants.findIndex(p => p.participant_name === pick.player_name) + 1,
                  playerName: pick.player_name,
                  movie: {
                    id: pick.movie_id,
                    title: pick.movie_title,
                    year: pick.movie_year,
                    poster_path: pick.poster_path
                  },
                  category: pick.category
                }))} 
                currentPlayerId={participants.findIndex(p => (p.user_id || p.guest_participant_id) === participantId) + 1}
                theme={draft.theme}
                option={draft.option}
              />

              <PickConfirmation currentPlayerName={currentTurnPlayer?.participant_name || 'You'} selectedMovie={selectedMovie} selectedCategory={selectedCategory} onConfirm={confirmPick} />
            </>
            }

          </div>
        </div>

      </div>
    </div>
  );
};
