
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Users, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick } from '@/hooks/useDrafts';
import TeamRoster from '@/components/TeamRoster';
import { getScoreColor, getScoreGrade } from '@/utils/scoreCalculator';

interface TeamScore {
  playerName: string;
  picks: DraftPick[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

const FinalScores = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { getDraftWithPicks } = useDraftOperations();
  const { toast } = useToast();
  
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [enrichingData, setEnrichingData] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!draftId) {
      navigate('/profile');
      return;
    }

    fetchDraftData();
  }, [draftId]);

  const fetchDraftData = async () => {
    try {
      setLoadingData(true);
      const { draft: draftData, picks: picksData } = await getDraftWithPicks(draftId!);
      setDraft(draftData);
      setPicks(picksData || []);
      
      // Process team scores
      const teams = processTeamScores(picksData || []);
      setTeamScores(teams);
      
      if (teams.length > 0) {
        setSelectedTeam(teams[0].playerName);
      }
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
        .filter(pick => pick.calculated_score !== null)
        .map(pick => pick.calculated_score!);
      
      const averageScore = validScores.length > 0 
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0;

      teams.push({
        playerName,
        picks: playerPicks,
        averageScore,
        completedPicks: validScores.length,
        totalPicks: playerPicks.length
      });
    });

    // Sort by average score (descending)
    return teams.sort((a, b) => b.averageScore - a.averageScore);
  };

  const enrichAllMovies = async () => {
    if (!picks.length) return;

    setEnrichingData(true);
    const moviesToEnrich = picks.filter(pick => !pick.scoring_data_complete);
    
    if (moviesToEnrich.length === 0) {
      toast({
        title: "All movies already enriched",
        description: "All movies in this draft have complete scoring data",
      });
      setEnrichingData(false);
      return;
    }

    toast({
      title: "Enriching movie data",
      description: `Processing ${moviesToEnrich.length} movies...`,
    });

    try {
      const enrichmentPromises = moviesToEnrich.map(pick => 
        supabase.functions.invoke('enrich-movie-data', {
          body: {
            movieId: pick.movie_id,
            movieTitle: pick.movie_title,
            movieYear: pick.movie_year
          }
        })
      );

      await Promise.allSettled(enrichmentPromises);
      
      // Refresh data
      await fetchDraftData();
      
      toast({
        title: "Data enrichment complete",
        description: "Movie scoring data has been updated",
      });
    } catch (error) {
      console.error('Error enriching movie data:', error);
      toast({
        title: "Enrichment failed",
        description: "Some movies could not be processed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setEnrichingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !draft) {
    return null;
  }

  const incompletePicks = picks.filter(pick => !pick.scoring_data_complete).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/profile')}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Profile
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Final Scores</h1>
              <p className="text-gray-400">{draft.title}</p>
            </div>
          </div>
          
          {incompletePicks > 0 && (
            <Button
              onClick={enrichAllMovies}
              disabled={enrichingData}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              {enrichingData ? (
                <RefreshCw size={16} className="mr-2 animate-spin" />
              ) : (
                <Zap size={16} className="mr-2" />
              )}
              {enrichingData ? 'Processing...' : 'Enrich Missing Data'}
            </Button>
          )}
        </div>

        <Tabs value={selectedTeam ? 'teams' : 'leaderboard'} className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-600">
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-gray-700">
              <Trophy size={16} className="mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-gray-700">
              <Users size={16} className="mr-2" />
              Team Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-4">
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{teamScores.length}</div>
                    <div className="text-gray-400">Teams</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{picks.length}</div>
                    <div className="text-gray-400">Total Picks</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {picks.length - incompletePicks}
                    </div>
                    <div className="text-gray-400">Scored Movies</div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                      className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-400 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
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
                        <div className={`text-xl font-bold ${getScoreColor(team.averageScore)}`}>
                          {team.averageScore.toFixed(1)}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {getScoreGrade(team.averageScore)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            {/* Team Selection */}
            <div className="flex gap-2 flex-wrap">
              {teamScores.map((team, index) => (
                <Button
                  key={team.playerName}
                  onClick={() => setSelectedTeam(team.playerName)}
                  variant={selectedTeam === team.playerName ? "default" : "outline"}
                  className={selectedTeam === team.playerName ? 
                    "bg-yellow-400 text-black hover:bg-yellow-500" : 
                    "border-gray-600 text-gray-300 hover:bg-gray-700"
                  }
                >
                  #{index + 1} {team.playerName}
                </Button>
              ))}
            </div>

            {/* Selected Team Roster */}
            {selectedTeam && teamScores.find(t => t.playerName === selectedTeam) && (
              <TeamRoster
                playerName={selectedTeam}
                picks={teamScores.find(t => t.playerName === selectedTeam)!.picks}
                teamRank={teamScores.findIndex(t => t.playerName === selectedTeam) + 1}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FinalScores;
