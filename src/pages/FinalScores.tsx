import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Users, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick } from '@/hooks/useDrafts';
import TeamRoster from '@/components/TeamRoster';
import ShareResultsButton from '@/components/ShareResultsButton';
import SaveDraftButton from '@/components/SaveDraftButton';
import { SaveDraftPrompt } from '@/components/SaveDraftPrompt';
import { getScoreColor, getScoreGrade } from '@/utils/scoreCalculator';

interface TeamScore {
  playerName: string;
  picks: DraftPick[];
  totalScore: number;
  completedPicks: number;
  totalPicks: number;
}

const FinalScores = () => {
  const { draftId } = useParams<{ draftId: string; }>();
  const navigate = useNavigate();
  const { user, loading, isGuest } = useAuth();
  const { getDraftWithPicks } = useDraftOperations();
  const { toast } = useToast();
  
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [enrichingData, setEnrichingData] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  useEffect(() => {
    if (!draftId) {
      navigate('/profile');
      return;
    }
    fetchDraftData();
  }, [draftId]);

  const fixUnknownPlayers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fix-unknown-players', {
        body: { draftId }
      });

      if (error) {
        console.error('Error fixing unknown players:', error);
      } else {
        console.log('Fixed unknown players:', data);
        // Refresh the data after fixing
        const { draft: refreshedDraft, picks: refreshedPicks } = await getDraftWithPicks(draftId!);
        setPicks(refreshedPicks || []);
        const refreshedTeams = processTeamScores(refreshedPicks || []);
        setTeamScores(refreshedTeams);
      }
    } catch (error) {
      console.error('Error calling fix-unknown-players function:', error);
    }
  };

  const fetchDraftData = async () => {
    try {
      setLoadingData(true);
      const { draft: draftData, picks: picksData } = await getDraftWithPicks(draftId!);
      setDraft(draftData);
      setPicks(picksData || []);
      
      console.log('Fetched picks with scoring data:', picksData?.map(p => ({
        title: p.movie_title,
        player_name: p.player_name,
        scoring_data_complete: (p as any).scoring_data_complete,
        calculated_score: (p as any).calculated_score,
        imdb_rating: (p as any).imdb_rating,
        rt_critics_score: (p as any).rt_critics_score
      })));

      // Check for unknown players and fix them
      const hasUnknownPlayers = picksData?.some(pick => 
        pick.player_name === 'Unknown Player' || 
        pick.player_name === 'Unknown User' ||
        !pick.player_name
      );
      
      if (hasUnknownPlayers) {
        console.log('Found unknown players, attempting to fix...');
        await fixUnknownPlayers();
      } else {
        // Process team scores normally
        const teams = processTeamScores(picksData || []);
        setTeamScores(teams);
        if (teams.length > 0) {
          setSelectedTeam(teams[0].playerName);
        }
      }

      // Automatically enrich data if needed
      await autoEnrichMovieData(picksData || []);
    } catch (error) {
      console.error('Error fetching draft data:', error);
      toast({
        title: "Error",
        description: "Failed to load draft data",
        variant: "destructive"
      });
      navigate('/profile');
    } finally {
      setLoadingData(false);
    }
  };

  const backfillMovieGenres = async () => {
    console.log('Starting movie genre backfill...');
    
    try {
      const { data, error } = await supabase.functions.invoke('backfill-movie-genres');

      if (error) {
        console.error('Failed to backfill movie genres:', error);
      } else {
        console.log('Successfully backfilled movie genres:', data);
      }
    } catch (error) {
      console.error('Error during genre backfill:', error);
    }
  };

  const autoEnrichMovieData = async (picksData: DraftPick[]) => {
    // First, backfill any missing genres
    await backfillMovieGenres();

    // Check for movies that need RT/IMDB/Metacritic data or poster data
    const moviesToEnrich = picksData.filter(pick => {
      const pickWithScoring = pick as any;
      return !pickWithScoring.rt_critics_score || !pickWithScoring.imdb_rating || !pickWithScoring.metacritic_score || !pickWithScoring.poster_path;
    });
    
    console.log('Auto-enriching movies:', moviesToEnrich.length, 'Total picks:', picksData.length);
    
    if (moviesToEnrich.length === 0) {
      console.log('All movies already have scoring data');
      return;
    }

    setEnrichingData(true);
    toast({
      title: "Loading movie data",
      description: `Processing ${moviesToEnrich.length} movies automatically...`
    });

    try {
      // Process movies one by one to avoid rate limiting
      for (const pick of moviesToEnrich) {
        console.log(`Auto-processing movie: ${pick.movie_title} (${pick.movie_year})`);
        const { data, error } = await supabase.functions.invoke('enrich-movie-data', {
          body: {
            movieId: pick.movie_id,
            movieTitle: pick.movie_title,
            movieYear: pick.movie_year
          }
        });

        if (error) {
          console.error(`Error enriching ${pick.movie_title}:`, error);
        } else {
          console.log(`Successfully enriched ${pick.movie_title}:`, data);
        }

        // Small delay to avoid overwhelming the APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Refresh data after all movies are processed
      const { draft: refreshedDraft, picks: refreshedPicks } = await getDraftWithPicks(draftId!);
      setPicks(refreshedPicks || []);

      // Recalculate team scores
      const refreshedTeams = processTeamScores(refreshedPicks || []);
      setTeamScores(refreshedTeams);

      toast({
        title: "Movie data loaded",
        description: "All movie scoring data has been updated automatically"
      });
    } catch (error) {
      console.error('Error auto-enriching movie data:', error);
      toast({
        title: "Data loading failed",
        description: "Some movies could not be processed automatically",
        variant: "destructive"
      });
    } finally {
      setEnrichingData(false);
    }
  };

  const processTeamScores = (picksData: DraftPick[]): TeamScore[] => {
    const teamMap = new Map<string, DraftPick[]>();

    // Group picks by player
    picksData.forEach(pick => {
      if (!teamMap.has(pick.player_name)) {
        teamMap.set(pick.player_name, []);
      }
      teamMap.get(pick.player_name)!.push(pick);
    });

    // Calculate team scores
    const teams: TeamScore[] = [];
    teamMap.forEach((playerPicks, playerName) => {
      const validScores = playerPicks
        .filter(pick => (pick as any).calculated_score !== null && (pick as any).calculated_score !== undefined)
        .map(pick => (pick as any).calculated_score!);
      
      const totalScore = validScores.length > 0 
        ? validScores.reduce((sum: number, score: number) => sum + score, 0)
        : 0;

      teams.push({
        playerName,
        picks: playerPicks,
        totalScore,
        completedPicks: validScores.length,
        totalPicks: playerPicks.length
      });
    });

    // Sort by total score (descending)
    return teams.sort((a, b) => b.totalScore - a.totalScore);
  };

  const handleSignUp = () => {
    navigate('/auth');
  };

  const getDraftDataForSave = () => {
    if (!draft) return null;
    
    return {
      theme: draft.theme,
      option: draft.option,
      participants: draft.participants,
      categories: draft.categories,
      picks: picks.map(pick => ({
        playerId: pick.player_id,
        playerName: pick.player_name,
        movie: {
          id: pick.movie_id,
          title: pick.movie_title,
          year: pick.movie_year,
          genre: pick.movie_genre,
          posterPath: pick.poster_path
        },
        category: pick.category
      })),
      isComplete: draft.is_complete
    };
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">
          {enrichingData ? (
            <div className="flex items-center gap-3">
              <RefreshCw size={24} className="animate-spin" />
              Loading movie data...
            </div>
          ) : (
            'Loading...'
          )}
        </div>
      </div>
    );
  }

  // Allow viewing final scores without authentication for social sharing
  if (!draft) {
    return null;
  }

  // Count movies that need enrichment (incomplete OR score of 0)
  const incompletePicks = picks.filter(pick => {
    const pickWithScoring = pick as any;
    return !pickWithScoring.scoring_data_complete || 
           pickWithScoring.calculated_score === null || 
           pickWithScoring.calculated_score === 0;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Final Scores</h1>
              <p className="text-gray-400">{draft.title}</p>
              {enrichingData && (
                <p className="text-yellow-400 text-sm mt-1 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Processing movie data automatically...
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            {/* Save Draft Button for Guest Users */}
            {isGuest && (
              <Button
                onClick={() => setShowSavePrompt(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                Save Draft
              </Button>
            )}
            
            {/* Share Results Button */}
            {teamScores.length > 0 && !enrichingData && (
              <ShareResultsButton
                draftTitle={draft.title}
                teamScores={teamScores}
                picks={picks}
              />
            )}
          </div>
        </div>

        {/* Save Draft Prompt */}
        <SaveDraftPrompt
          isOpen={showSavePrompt}
          onClose={() => setShowSavePrompt(false)}
          onSignUp={handleSignUp}
          draftTitle={draft.title}
        />

        {/* Show loading state while enriching */}
        {enrichingData && (
          <Card className="bg-gray-800 border-gray-600 mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <RefreshCw size={32} className="animate-spin text-yellow-400 mx-auto mb-3" />
                <p className="text-white text-lg">Processing movie scoring data...</p>
                <p className="text-gray-400 text-sm">Please wait while we gather data from movie databases</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* Leaderboard */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="text-yellow-400" />
                Team Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamScores.map((team, index) => (
                  <div
                    key={team.playerName}
                    onClick={() => setSelectedTeam(team.playerName)}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedTeam === team.playerName 
                        ? 'bg-yellow-400/20 border-yellow-400/50' 
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? 'bg-yellow-400 text-black'
                            : index === 1
                            ? 'bg-gray-400 text-black'
                            : index === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{team.playerName}</h3>
                        <p className="text-gray-400 text-sm">
                          {team.completedPicks}/{team.totalPicks} movies scored
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xl font-bold text-yellow-400">
                        {team.totalScore.toFixed(1)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Total Score
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Team Roster */}
          {selectedTeam && teamScores.find(t => t.playerName === selectedTeam) && (
            <TeamRoster
              playerName={selectedTeam}
              picks={teamScores.find(t => t.playerName === selectedTeam)!.picks}
              teamRank={teamScores.findIndex(t => t.playerName === selectedTeam) + 1}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalScores;
