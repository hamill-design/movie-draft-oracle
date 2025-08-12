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
  return <div className="min-h-screen" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div>
              <div className="flex items-center gap-3 mb-2">
                {draft.theme === 'people' ? <DraftActorPortrait actorName={getCleanActorName(draft.option)} size="md" /> : <Calendar size={24} className="text-yellow-400" />}
                <CardTitle className="text-2xl">
                  {draft.theme === 'people' ? getCleanActorName(draft.option) : draft.option}
                </CardTitle>
              </div>
              <Badge variant="secondary" className="w-fit">
                Multiplayer
              </Badge>
            </div>
          </CardHeader>
        </Card>

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
                  <Button 
                    onClick={() => navigate(`/final-scores/${draft.id}?public=true`)}
                    className="w-full md:w-auto"
                  >
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-2xl font-bold">
                  Join Code
                </CardTitle>
                {draft.invite_code && (
                  <div className="flex items-center gap-2 min-w-[295px]">
                    <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                      {draft.invite_code}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={copyInviteCode} className="flex items-center gap-2">
                      {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <h3 className="font-medium text-lg">Participants</h3>
                </div>
                <div className="space-y-2">
                  {participants.map(participant => {
                    const pId = participant.user_id || participant.guest_participant_id;
                    const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
                    const isCurrentTurn = pId === currentTurnId;
                    return <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {participant.participant_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{participant.participant_name}</span>
                              {participant.is_host && <Badge variant="outline" className="text-xs">Host</Badge>}
                              {isCurrentTurn && !isComplete && draftHasStarted && <Badge variant="default" className="text-xs">Current Turn</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {participant.status === 'joined' ? 'Joined' : participant.status}
                            </div>
                          </div>
                        </div>;
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
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