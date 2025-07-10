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
import { getScoreColor, getScoreGrade } from '@/utils/scoreCalculator';
interface TeamScore {
  playerName: string;
  picks: DraftPick[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}
const FinalScores = () => {
  const {
    draftId
  } = useParams<{
    draftId: string;
  }>();
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  const {
    getDraftWithPicks
  } = useDraftOperations();
  const {
    toast
  } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [enrichingData, setEnrichingData] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  // Only redirect to auth if user is actively trying to access protected features
  // Don't redirect for social media crawlers viewing the results

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
      const {
        draft: draftData,
        picks: picksData
      } = await getDraftWithPicks(draftId!);
      setDraft(draftData);
      setPicks(picksData || []);
      console.log('Fetched picks with scoring data:', picksData?.map(p => ({
        title: p.movie_title,
        scoring_data_complete: (p as any).scoring_data_complete,
        calculated_score: (p as any).calculated_score,
        imdb_rating: (p as any).imdb_rating,
        rt_critics_score: (p as any).rt_critics_score
      })));

      // Process team scores
      const teams = processTeamScores(picksData || []);
      setTeamScores(teams);
      if (teams.length > 0) {
        setSelectedTeam(teams[0].playerName);
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
  const autoEnrichMovieData = async (picksData: DraftPick[]) => {
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
        const {
          data,
          error
        } = await supabase.functions.invoke('enrich-movie-data', {
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
      const {
        draft: refreshedDraft,
        picks: refreshedPicks
      } = await getDraftWithPicks(draftId!);
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
      const validScores = playerPicks.filter(pick => (pick as any).calculated_score !== null && (pick as any).calculated_score !== undefined).map(pick => (pick as any).calculated_score!);
      const averageScore = validScores.length > 0 ? validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length : 0;
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
  if (loading || loadingData) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">
          {enrichingData ? <div className="flex items-center gap-3">
              <RefreshCw size={24} className="animate-spin" />
              Loading movie data...
            </div> : 'Loading...'}
        </div>
      </div>;
  }

  // Allow viewing final scores without authentication for social sharing
  if (!draft) {
    return null;
  }

  // Count movies that need enrichment (incomplete OR score of 0)
  const incompletePicks = picks.filter(pick => {
    const pickWithScoring = pick as any;
    return !pickWithScoring.scoring_data_complete || pickWithScoring.calculated_score === null || pickWithScoring.calculated_score === 0;
  }).length;
  return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {user}
            <div>
              <h1 className="text-3xl font-bold text-white">Final Scores</h1>
              <p className="text-gray-400">{draft.title}</p>
              {enrichingData && <p className="text-yellow-400 text-sm mt-1 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Processing movie data automatically...
                </p>}
            </div>
          </div>
          
        </div>

        {/* Show loading state while enriching */}
        {enrichingData && <Card className="bg-gray-800 border-gray-600 mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <RefreshCw size={32} className="animate-spin text-yellow-400 mx-auto mb-3" />
                <p className="text-white text-lg">Processing movie scoring data...</p>
                <p className="text-gray-400 text-sm">Please wait while we gather data from movie databases</p>
              </div>
            </CardContent>
          </Card>}

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
                  {teamScores.map((team, index) => <div key={team.playerName} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-400 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-600 text-white' : 'bg-gray-600 text-white'}`}>
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
                    </div>)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            {/* Team Selection */}
            <div className="flex gap-2 flex-wrap">
              {teamScores.map((team, index) => <Button key={team.playerName} onClick={() => setSelectedTeam(team.playerName)} variant={selectedTeam === team.playerName ? "default" : "outline"} className={selectedTeam === team.playerName ? "bg-yellow-400 text-black hover:bg-yellow-500" : "border-gray-600 text-gray-300 hover:bg-gray-700"}>
                  #{index + 1} {team.playerName}
                </Button>)}
            </div>

            {/* Selected Team Roster */}
            {selectedTeam && teamScores.find(t => t.playerName === selectedTeam) && <TeamRoster playerName={selectedTeam} picks={teamScores.find(t => t.playerName === selectedTeam)!.picks} teamRank={teamScores.findIndex(t => t.playerName === selectedTeam) + 1} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};
export default FinalScores;