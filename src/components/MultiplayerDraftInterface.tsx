import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Check, Users, Clock, Film, User, Calendar, Trophy } from 'lucide-react';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import MovieSearch from '@/components/MovieSearch';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import CategorySelection from '@/components/CategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftBoard from '@/components/DraftBoard';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosticInfo } from '@/components/DiagnosticInfo';
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
  initialDraftData?: {
    draft: any;
    participants: any[];
    picks: any[];
  };
}
export const MultiplayerDraftInterface = ({
  draftId,
  initialData,
  initialDraftData
}: MultiplayerDraftInterfaceProps) => {
  const {
    participantId,
    isAuthenticated,
    user
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
    createMultiplayerDraft,
    joinDraftByCode,
    makePick,
    startDraft
  } = useMultiplayerDraft(draftId);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Get base category for movie search
  const getBaseCategory = () => {
    if (!draft) return '';
    if (draft.theme === 'people') {
      return 'person';
    }
    return 'popular';
  };

  // For theme-based drafts, pass the theme option (year or person name) as the constraint
  // This will fetch ALL movies for that year/person
  const themeConstraint = draft?.theme === 'year' || draft?.theme === 'people' ? draft.option : '';
  const {
    movies,
    loading: moviesLoading
  } = useMovies(getBaseCategory(), themeConstraint);

  // Create draft if this is a new multiplayer draft
  useEffect(() => {
    if (initialData && !draftId && participantId) {
      const createDraft = async () => {
        try {
          const newDraft = await createMultiplayerDraft({
            title: initialData.option,
            theme: initialData.theme,
            option: initialData.option,
            categories: initialData.categories,
            participantEmails: initialData.participants
          });

          // Navigate to the draft page with the multiplayer data
          navigate('/draft', {
            replace: true,
            state: {
              theme: initialData.theme,
              option: initialData.option,
              participants: initialData.participants,
              categories: initialData.categories,
              existingDraftId: newDraft.id,
              isMultiplayer: true
            }
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
    return <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>;
  }
  if (!participantId) {
    return <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Loading your session to participate in the draft...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>;
  }
  if (!draft) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
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
      </div>;
  }
  const currentTurnPlayer = getCurrentTurnPlayer();
  const isComplete = draft.is_complete;
  return <div className="min-h-screen" style={{
    background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'
  }}>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="p-6">
            <div className="flex flex-col justify-center items-center gap-4 text-center">
              <span className="text-text-primary text-[32px] font-brockmann font-medium leading-[36px] tracking-[1.28px]">
                NOW DRAFTING
              </span>
              <div className="text-[64px] font-chaney font-normal leading-[64px] text-center">
                <span className="text-purple-500">
                  {draft.theme === 'people' ? getCleanActorName(draft.option).toUpperCase() + ' ' : draft.option.toString() + ' '}
                </span>
                <span className="text-text-primary">
                  MOVIES
                </span>
              </div>
              
            </div>
          </div>
        </div>

        {/* Status and Participants */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Draft Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isComplete ? <div className="text-center space-y-4">
                  <div>
                    <Badge variant="default" className="mb-2">Draft Complete</Badge>
                    <p className="text-muted-foreground">All picks have been made!</p>
                  </div>
                  <Button onClick={() => navigate(`/final-scores/${draft.id}?public=true`)} className="w-full md:w-auto">
                    <Trophy className="mr-2 h-4 w-4 text-yellow-400" />
                    View Final Scores
                  </Button>
                </div> : <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Turn:</span>
                    <Badge variant={isMyTurn ? "default" : "secondary"}>
                      {currentTurnPlayer?.participant_name || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pick Number:</span>
                    <span className="font-semibold">{draft.current_pick_number}</span>
                  </div>
                  {isMyTurn && <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-medium text-primary">🎬 It's your turn!</p>
                      <p className="text-xs text-muted-foreground">Select a movie and category below</p>
                    </div>}
                </div>}
            </CardContent>
          </Card>

          {/* Unified participants container with background treatment */}
          <div className="w-full bg-[#FCFFFF] p-6 rounded shadow-[0px_0px_3px_rgba(0,0,0,0.25)] flex flex-col gap-6">
            {/* Join Code section */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-2xl font-bold font-brockmann" style={{letterSpacing: '0.24px'}}>
                Join Code
              </CardTitle>
              {draft.invite_code && <div className="flex items-center gap-2 min-w-[295px] ml-auto">
                  <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                    {draft.invite_code}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={copyInviteCode} className="flex items-center gap-2">
                    {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </Button>
                </div>}
            </div>
            
            {/* Participants header matching StyledHeading4 */}
            <div className="flex items-center gap-2">
            <div className="w-6 h-6 p-0.5 flex flex-col justify-center items-center">
              <MultiPersonIcon className="w-6 h-6 text-[#680AFF]" />
            </div>
              <span className="text-xl font-medium font-brockmann leading-7 text-[#2B2D2D]">Participants</span>
            </div>
            
            {/* Participants list with proper gap */}
            <div className="flex flex-col gap-2">
              {participants.map(participant => {
              const pId = participant.user_id || participant.guest_participant_id;
              const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
              const isCurrentTurn = pId === currentTurnId;
              return <div key={participant.id} className="flex items-center gap-2 py-3 px-4 bg-white" style={{borderRadius: '2px', outline: '0.5px solid #BDC3C2', outlineOffset: '-0.5px'}}>
                    <div className="flex-1 flex flex-col gap-1 pb-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 flex flex-col">
                          <span className="font-semibold text-base font-brockmann leading-6 tracking-wide text-[#2B2D2D]">{participant.participant_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {participant.is_host && <div className="w-full h-full px-3 py-1 bg-[#F8F7FF] rounded-full" style={{outline: '0.50px #25015E solid', outlineOffset: '-0.50px', justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex'}}>
                              <div className="flex flex-col justify-center text-[#100029] text-xs font-brockmann font-semibold leading-4">Host</div>
                            </div>}
                          {isCurrentTurn && !isComplete && draftHasStarted && <div className="px-3 py-1 bg-[#25015E] rounded-full">
                              <span className="text-xs font-semibold font-brockmann leading-4 text-white">Current Turn</span>
                            </div>}
                        </div>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-xs font-normal font-brockmann leading-4 text-[#06C995]">
                          {participant.status === 'joined' ? 'Joined' : participant.status}
                        </span>
                        {participant.user_id && <span className="text-xs font-normal font-brockmann leading-4 text-[#828786]">
                            {participant.participant_name.toLowerCase().replace(/\s+/g, '')}@gmail.com
                          </span>}
                      </div>
                    </div>
                  </div>;
            })}
            </div>
          </div>
        </div>

        {/* Start Draft Button - Show only to host when conditions are met */}
        {!draftHasStarted && participants.length >= 2 && !isComplete && isHost && <Card>
            <CardContent className="p-6 text-center">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Ready to Start?</h3>
                  <p className="text-sm text-muted-foreground">
                    {participants.length} players have joined. Click below to randomize turn order and start the draft!
                  </p>
                </div>
                <Button onClick={() => startDraft(draft.id)} className="w-full md:w-auto" disabled={loading}>
                  {loading ? 'Starting...' : '🎲 Start Draft (Random Turn Order)'}
                </Button>
              </div>
            </CardContent>
          </Card>}

        {/* Waiting for Players - Show when not enough players */}
        {!draftHasStarted && participants.length < 2 && <Card>
            <CardContent className="p-6 text-center">
              <div className="space-y-2">
                <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                <h3 className="font-semibold">Waiting for Players</h3>
                <p className="text-sm text-muted-foreground">
                  Need at least 2 players to start the draft. Share the invite code above!
                </p>
              </div>
            </CardContent>
          </Card>}

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
          }))} players={participants.map((p, index) => ({
            id: index + 1,
            name: p.participant_name
          }))} categories={draft.categories} theme={draft.theme} draftOption={getCleanActorName(draft.option)} currentPlayer={currentTurnPlayer ? {
            id: participants.findIndex(p => (p.user_id || p.guest_participant_id) === (currentTurnPlayer.user_id || currentTurnPlayer.guest_participant_id)) + 1,
            name: currentTurnPlayer.participant_name
          } : undefined} />
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {!isComplete && isMyTurn && <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="h-5 w-5" />
                      Make Your Pick
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MovieSearch theme={draft.theme} option={getCleanActorName(draft.option)} searchQuery={searchQuery} onSearchChange={setSearchQuery} movies={movies} loading={moviesLoading} onMovieSelect={handleMovieSelect} selectedMovie={selectedMovie} themeParameter={themeConstraint} />

                    

                    <CategorySelection selectedMovie={selectedMovie} categories={draft.categories} selectedCategory={selectedCategory} onCategorySelect={handleCategorySelect} picks={picks.map(pick => ({
                  playerId: participants.findIndex(p => p.participant_name === pick.player_name) + 1,
                  playerName: pick.player_name,
                  movie: {
                    id: pick.movie_id,
                    title: pick.movie_title,
                    year: pick.movie_year,
                    poster_path: pick.poster_path
                  },
                  category: pick.category
                }))} currentPlayerId={participants.findIndex(p => (p.user_id || p.guest_participant_id) === participantId) + 1} />

                    

                    <PickConfirmation currentPlayerName={currentTurnPlayer?.participant_name || 'You'} selectedMovie={selectedMovie} selectedCategory={selectedCategory} onConfirm={confirmPick} />
                  </CardContent>
                </Card>
              </>}

            {!isComplete && !isMyTurn && draftHasStarted && <Card>
                <CardContent className="p-6 text-center">
                  <div className="space-y-2">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                    <h3 className="font-semibold">Waiting for {currentTurnPlayer?.participant_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      It's their turn to pick a movie. You'll be notified when it's your turn!
                    </p>
                  </div>
                </CardContent>
              </Card>}
          </div>
        </div>

        {/* Diagnostic Info */}
        <DiagnosticInfo draft={draft} participants={participants} picks={picks} user={user} isMyTurn={isMyTurn} />
      </div>
    </div>;
};