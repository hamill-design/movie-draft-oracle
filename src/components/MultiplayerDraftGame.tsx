import { useState } from 'react';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useMovies } from '@/hooks/useMovies';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DraftBoard from './DraftBoard';
import MovieSearch from './MovieSearch';
import CategorySelection from './CategorySelection';
import PickConfirmation from './PickConfirmation';

interface MultiplayerDraftGameProps {
  draftId: string;
}

export const MultiplayerDraftGame = ({ draftId }: MultiplayerDraftGameProps) => {
  const { toast } = useToast();
  const {
    draft,
    participants,
    picks,
    loading,
    isMyTurn,
    makePick,
    startDraft,
  } = useMultiplayerDraft(draftId);

  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Use movies hook for search functionality
  const { movies, loading: moviesLoading } = useMovies('genre', searchQuery);

  // Copy invite code to clipboard
  const copyInviteCode = async () => {
    if (!draft?.invite_code) return;
    
    try {
      await navigator.clipboard.writeText(draft.invite_code);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy invite code",
        variant: "destructive",
      });
    }
  };

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = async () => {
    if (!selectedMovie || !selectedCategory) {
      toast({
        title: "Error",
        description: "Please select both a movie and category",
        variant: "destructive",
      });
      return;
    }

    try {
      await makePick(selectedMovie, selectedCategory);
      setSelectedMovie(null);
      setSelectedCategory('');
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to make pick:', error);
    }
  };

  const handleStartDraft = async () => {
    if (!draft) return;
    
    try {
      await startDraft(draft.id);
    } catch (error) {
      console.error('Failed to start draft:', error);
    }
  };

  if (loading && !draft) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">Draft not found</p>
        </div>
      </div>
    );
  }

  const joinedParticipants = participants.filter(p => p.status === 'joined');
  const hasEnoughPlayers = joinedParticipants.length >= 2;
  const draftStarted = draft.current_turn_user_id !== null;
  const canStartDraft = hasEnoughPlayers && !draftStarted && participants.some(p => p.is_host);

  // Current player info
  const currentPlayerIndex = joinedParticipants.findIndex(p => p.user_id === draft.current_turn_user_id);
  const currentPlayerId = currentPlayerIndex + 1;
  const currentPlayerName = joinedParticipants.find(p => p.user_id === draft.current_turn_user_id)?.participant_name || '';

  // Transform picks for DraftBoard
  const transformedPicks = picks.map(pick => ({
    playerId: pick.player_id,
    playerName: pick.player_name,
    movie: {
      id: pick.movie_id,
      title: pick.movie_title,
      poster_path: pick.poster_path,
      year: pick.movie_year
    },
    category: pick.category
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{draft.title}</h1>
              <p className="text-muted-foreground">
                {draft.theme} • {draft.option}
              </p>
            </div>
            
            {draft.invite_code && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Invite Code:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyInviteCode}
                  className="font-mono"
                >
                  {draft.invite_code}
                  <Copy className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="mt-4">
            <h3 className="font-medium mb-2">
              Participants ({joinedParticipants.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {joinedParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className={`px-3 py-1 rounded-full text-sm ${
                    participant.is_host
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {participant.participant_name}
                  {participant.is_host && ' (Host)'}
                </div>
              ))}
            </div>
          </div>

          {/* Draft Status */}
          <div className="mt-4">
            {!hasEnoughPlayers && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <p className="text-warning-foreground">
                  Waiting for more players... (Need at least 2 players)
                </p>
              </div>
            )}

            {canStartDraft && (
              <Button onClick={handleStartDraft} className="mt-2">
                Start Draft
              </Button>
            )}

            {draftStarted && !draft.is_complete && (
              <div className="bg-info/10 border border-info/20 rounded-lg p-4">
                <p className="text-info-foreground">
                  {isMyTurn 
                    ? "🎯 It's your turn! Make your pick below."
                    : `⏳ Waiting for ${currentPlayerName || 'player'} to pick...`
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft Board */}
      <div className="container mx-auto px-4 py-6">
        <DraftBoard
          players={joinedParticipants.map((p, index) => ({
            id: index + 1,
            name: p.participant_name
          }))}
          categories={draft.categories}
          picks={transformedPicks}
          theme={draft.theme}
          currentPlayer={
            draftStarted && currentPlayerIndex >= 0 
              ? {
                  id: currentPlayerId,
                  name: currentPlayerName
                }
              : undefined
          }
        />

        {/* Pick Interface */}
        {draftStarted && !draft.is_complete && isMyTurn && (
          <div className="mt-8 space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Make Your Pick</h2>
              
              {!selectedMovie && (
                <MovieSearch
                  theme={draft.theme}
                  option={draft.option}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  movies={movies}
                  loading={moviesLoading}
                  selectedMovie={selectedMovie}
                  onMovieSelect={handleMovieSelect}
                  themeParameter={draft.option}
                />
              )}

              {selectedMovie && !selectedCategory && (
                <CategorySelection
                  selectedMovie={selectedMovie}
                  categories={draft.categories}
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                  picks={transformedPicks}
                  currentPlayerId={currentPlayerId}
                />
              )}

              {selectedMovie && selectedCategory && (
                <PickConfirmation
                  currentPlayerName={currentPlayerName}
                  selectedMovie={selectedMovie}
                  selectedCategory={selectedCategory}
                  onConfirm={confirmPick}
                />
              )}
              
              {(selectedMovie || selectedCategory) && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedMovie(null);
                      setSelectedCategory('');
                    }}
                  >
                    Start Over
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Draft Complete Message */}
        {draft.is_complete && (
          <div className="mt-8 bg-card border rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold mb-2">🎉 Draft Complete!</h2>
            <p className="text-muted-foreground">
              All picks have been made. Check out the final results above!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};