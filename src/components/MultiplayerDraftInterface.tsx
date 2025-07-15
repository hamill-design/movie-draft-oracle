import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useAuth } from '@/contexts/AuthContext';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Check, Users, Clock, Film, User, Calendar } from 'lucide-react';
import MovieSearch from '@/components/MovieSearch';
import CategorySelection from '@/components/CategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftBoard from '@/components/DraftBoard';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosticInfo } from '@/components/DiagnosticInfo';
import EmailDiagnostic from '@/components/EmailDiagnostic';

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

export const MultiplayerDraftInterface = ({ draftId, initialData }: MultiplayerDraftInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
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
    startDraft,
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
  const themeConstraint = draft?.theme === 'year' || draft?.theme === 'people' 
    ? draft.option 
    : '';

  const { movies, loading: moviesLoading } = useMovies(getBaseCategory(), themeConstraint);

  // Create draft if this is a new multiplayer draft
  useEffect(() => {
    if (initialData && !draftId && user) {
      const createDraft = async () => {
        try {
          const newDraft = await createMultiplayerDraft({
            title: initialData.option,
            theme: initialData.theme,
            option: initialData.option,
            categories: initialData.categories,
            participantEmails: initialData.participants,
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
            variant: "destructive",
          });
        }
      };

      createDraft();
    }
  }, [initialData, draftId, user, createMultiplayerDraft, navigate, toast]);

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = async () => {
    console.log('🔍 DIAGNOSTIC v1.0 - confirmPick called in MultiplayerDraftInterface');
    console.log('🔍 Selected movie:', selectedMovie);
    console.log('🔍 Selected category:', selectedCategory);
    console.log('🔍 Draft state:', draft);
    console.log('🔍 IsMyTurn:', isMyTurn);
    console.log('🔍 User:', user);
    console.log('🔍 Participants:', participants);
    
    if (!selectedMovie || !selectedCategory) {
      console.log('🚫 DIAGNOSTIC v1.0 - Missing movie or category');
      return;
    }

    try {
      console.log('🔍 DIAGNOSTIC v1.0 - Calling makePick...');
      await makePick(selectedMovie, selectedCategory);
      console.log('✅ DIAGNOSTIC v1.0 - makePick completed successfully');
      setSelectedMovie(null);
      setSelectedCategory('');
      setSearchQuery('');
    } catch (error) {
      console.error('🚫 DIAGNOSTIC v1.0 - Failed to make pick in interface:', error);
    }
  };

  const copyInviteCode = async () => {
    if (!draft?.invite_code) return;
    
    try {
      await navigator.clipboard.writeText(draft.invite_code);
      setCopySuccess(true);
      toast({
        title: "Invite Code Copied",
        description: "Share this code with friends to join the draft",
      });
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const getCurrentTurnPlayer = () => {
    return participants.find(p => p.user_id === draft?.current_turn_user_id);
  };

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
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {draft.theme === 'people' ? (
                    <User size={24} className="text-yellow-400" />
                  ) : (
                    <Calendar size={24} className="text-yellow-400" />
                  )}
                  <CardTitle className="text-2xl">{draft.option}</CardTitle>
                </div>
                <Badge variant="secondary" className="w-fit">
                  Multiplayer
                </Badge>
              </div>
              
              {draft.invite_code && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                    {draft.invite_code}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInviteCode}
                    className="flex items-center gap-2"
                  >
                    {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              )}
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
              {isComplete ? (
                <div className="text-center space-y-4">
                  <div>
                    <Badge variant="default" className="mb-2">Draft Complete</Badge>
                    <p className="text-muted-foreground">All picks have been made!</p>
                  </div>
                  <Button 
                    onClick={() => navigate(`/final-scores/${draft.id}`)}
                    className="w-full md:w-auto"
                  >
                    🏆 View Final Scores
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
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
                  {isMyTurn && (
                    <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-medium text-primary">🎬 It's your turn!</p>
                      <p className="text-xs text-muted-foreground">Select a movie and category below</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {participant.participant_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{participant.participant_name}</span>
                        {participant.is_host && (
                          <Badge variant="outline" className="text-xs">Host</Badge>
                        )}
                        {participant.user_id === draft.current_turn_user_id && !isComplete && (
                          <Badge variant="default" className="text-xs">Current Turn</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {participant.status === 'joined' ? 'Joined' : participant.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Start Draft Button - Show when draft hasn't started */}
        {!draft.current_turn_user_id && participants.length >= 2 && !isComplete && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Ready to Start?</h3>
                  <p className="text-sm text-muted-foreground">
                    {participants.length} players have joined. Click below to randomize turn order and start the draft!
                  </p>
                </div>
                <Button onClick={() => startDraft(draft.id)} className="w-full md:w-auto">
                  🎲 Start Draft (Random Turn Order)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waiting for Players - Show when not enough players */}
        {!draft.current_turn_user_id && participants.length < 2 && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="space-y-2">
                <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                <h3 className="font-semibold">Waiting for Players</h3>
                <p className="text-sm text-muted-foreground">
                  Need at least 2 players to start the draft. Share the invite code above!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Draft Content */}
        <div className="space-y-6">
          {/* Draft Board */}
          <div>
            <DraftBoard
              picks={picks.map(pick => ({
                playerId: pick.player_id,
                playerName: pick.player_name,
                movie: {
                  id: pick.movie_id,
                  title: pick.movie_title,
                  year: pick.movie_year,
                  poster_path: pick.poster_path
                },
                category: pick.category
              }))}
              players={participants.map((p, index) => ({ id: index + 1, name: p.participant_name }))}
              categories={draft.categories}
              theme={draft.theme}
              currentPlayer={currentTurnPlayer ? { 
                id: participants.findIndex(p => p.user_id === currentTurnPlayer.user_id) + 1, 
                name: currentTurnPlayer.participant_name 
              } : undefined}
            />
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {!isComplete && isMyTurn && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="h-5 w-5" />
                      Make Your Pick
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MovieSearch
                      theme={draft.theme}
                      option={draft.option}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      movies={movies}
                      loading={moviesLoading}
                      onMovieSelect={handleMovieSelect}
                      selectedMovie={selectedMovie}
                      themeParameter={themeConstraint}
                    />

                    <Separator />

                    <CategorySelection
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
                      currentPlayerId={participants.findIndex(p => p.user_id === user?.id) + 1}
                    />

                    {selectedMovie && selectedCategory && (
                      <>
                        <Separator />
                        <PickConfirmation
                          currentPlayerName={currentTurnPlayer?.participant_name || 'Unknown'}
                          selectedMovie={selectedMovie}
                          selectedCategory={selectedCategory}
                          onConfirm={confirmPick}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {!isComplete && !isMyTurn && (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="space-y-2">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                    <h3 className="font-semibold">Waiting for {currentTurnPlayer?.participant_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      It's their turn to make a pick
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Email Diagnostic - Temporary for debugging */}
      <EmailDiagnostic />

      {/* Diagnostic Info - Only show in development or when debugging */}
      <DiagnosticInfo
        draft={draft}
        participants={participants}
        picks={picks}
        user={user}
        isMyTurn={isMyTurn}
      />
    </div>
  );
};