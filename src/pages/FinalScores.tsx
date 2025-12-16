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
import { getScoreColor, getScoreGrade } from '@/utils/scoreCalculator';
import RankBadge from '@/components/RankBadge';

interface TeamScore {
  playerName: string;
  picks: DraftPick[];
  averageScore: number;
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
  const [hoveredTeam, setHoveredTeam] = useState<string>('');
  
  const [isPublicView, setIsPublicView] = useState(false);

  useEffect(() => {
    if (!draftId) {
      navigate('/');
      return;
    }
    
    // Check if this is a public share view
    const urlParams = new URLSearchParams(window.location.search);
    const isPublic = urlParams.get('public') === 'true';
    setIsPublicView(isPublic);
    
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
        if (refreshedTeams.length > 0) {
          setSelectedTeam(refreshedTeams[0].playerName);
        }
      }
    } catch (error) {
      console.error('Error calling fix-unknown-players function:', error);
    }
  };

  const fetchDraftData = async () => {
    try {
      setLoadingData(true);
      let draftData: any;
      let picksData: any[] = [];
      
      // For public views, try to load draft without authentication checks
      if (isPublicView) {
        const { data: publicDraft, error: draftError } = await supabase
          .from('drafts')
          .select('*')
          .eq('id', draftId!)
          .single();
          
        const { data: publicPicks, error: picksError } = await supabase
          .from('draft_picks')
          .select('*')
          .eq('draft_id', draftId!)
          .order('pick_order');
          
        if (draftError || picksError) {
          throw new Error('Failed to load public draft data');
        }
        
        draftData = publicDraft;
        picksData = publicPicks || [];
      } else {
        const { draft: fetchedDraft, picks: fetchedPicks } = await getDraftWithPicks(draftId!, isPublicView);
        draftData = fetchedDraft;
        picksData = fetchedPicks || [];
      }
      
      setDraft(draftData);
      setPicks(picksData);
      
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
        description: isPublicView ? "This draft is no longer available for public viewing" : "Failed to load draft data",
        variant: "destructive"
      });
      navigate(isPublicView ? '/' : '/profile');
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

  const fixMovieYears = async () => {
    console.log('Starting movie year fix...');
    
    try {
      const { data, error } = await supabase.functions.invoke('fix-movie-years');

      if (error) {
        console.error('Failed to fix movie years:', error);
      } else {
        console.log('Successfully fixed movie years:', data);
      }
    } catch (error) {
      console.error('Error during year fix:', error);
    }
  };

  const autoEnrichMovieData = async (picksData: DraftPick[]) => {
    // First, fix any incorrect movie years
    await fixMovieYears();
    
    // Then, backfill any missing genres
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
      
      const averageScore = validScores.length > 0 
        ? validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length
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

  const getRankingBadgeStyle = (index: number) => {
    const rank = index + 1;
    
    if (rank === 1) {
      // Gold - 1st place with gradient border effect using wrapper approach
      return {
        background: 'linear-gradient(to bottom right, #FFF2B2, #F0AA11)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 2) {
      // Silver - 2nd place with gradient border effect using wrapper approach
      return {
        background: 'linear-gradient(to bottom right, #E5E5E5, #666666)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 3) {
      // Bronze - 3rd place with gradient border effect using wrapper approach
      return {
        background: 'linear-gradient(to bottom right, #FFAE78, #95430C)',
        padding: '2px',
        color: 'var(--Greyscale-(Blue)-50, #F8F8F8)'
      };
    } else {
      // 4th place and beyond - plain dark
      return {
        background: 'var(--Greyscale-800, #4D4D4D)',
        color: 'var(--UI-Primary, white)'
      };
    }
  };

  const handleAuthRedirect = () => {
    toast({
      title: "Create Account",
      description: "Sign up to save drafts permanently and access them from any device."
    });
    navigate('/auth');
  };

  const getDraftDataForSave = () => {
    if (!draft) return null;
    
    return {
      title: draft.title,
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div className="text-text-primary text-xl">
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
    <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="w-full p-6 rounded-[8px] flex flex-wrap items-start content-start">
          <div className="flex-1 flex flex-col gap-6">
            <div className="self-stretch min-w-[310px] text-center flex flex-col justify-center">
              <div 
                className="break-words"
                style={{
                  fontSize: '64px', 
                  fontFamily: 'CHANEY', 
                  fontWeight: '400', 
                  lineHeight: '64px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0px',
                  gridGap: '0px',
                  maxWidth: '100%'
                }}
              >
                <span className="text-greyscale-blue-100">THE</span>
                <span className="text-brand-primary" style={{ margin: '0 0.5ch' }}>
                  {draft.title}
                </span>
                <span className="text-greyscale-blue-100">DRAFT</span>
              </div>
              {enrichingData && (
                <p className="text-yellow-400 text-sm mt-1 flex items-center gap-2 justify-center">
                  <RefreshCw size={14} className="animate-spin" />
                  Processing movie data automatically...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center mb-8">
          {/* Save Draft Button for Guest Users and Anonymous Viewers */}
          {(isGuest || isPublicView) && !user && (
            <Button
              onClick={handleAuthRedirect}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              Save Draft
            </Button>
          )}
          
          {/* Save Draft Button for Authenticated Users */}
          {user && !isPublicView && getDraftDataForSave() && (
            <SaveDraftButton draftData={getDraftDataForSave()!} />
          )}
          
          {/* Share Results Button */}
          {teamScores.length > 0 && !enrichingData && (
            <ShareResultsButton
              draftTitle={draft.title}
              teamScores={teamScores}
              picks={picks}
              draftId={draftId!}
              isPublicView={isPublicView}
            />
          )}
        </div>


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
          <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
            <div className="self-stretch flex flex-col justify-center items-center gap-2">
              <div className="text-center flex flex-col text-greyscale-blue-100 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
                FINAL SCORES
              </div>
            </div>
            <div className="self-stretch flex flex-col gap-4">
              {teamScores.map((team, index) => {
                const isSelected = selectedTeam === team.playerName;
                const isHovered = hoveredTeam === team.playerName;
                const isFirstPlace = index === 0;
                
                return (
                  <div
                    key={team.playerName}
                    onClick={() => setSelectedTeam(team.playerName)}
                    onMouseEnter={() => setHoveredTeam(team.playerName)}
                    onMouseLeave={() => setHoveredTeam('')}
                    className={`self-stretch py-4 pl-4 pr-6 rounded-[8px] flex items-center gap-4 cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-brand-primary' 
                        : isHovered 
                          ? 'bg-greyscale-purp-800' 
                          : 'bg-greyscale-purp-850'
                    }`}
                    style={{
                      outline: isSelected 
                        ? 'none' 
                        : '1px solid #49474B',
                      outlineOffset: '-1px'
                    }}
                  >
                    {/* Badge */}
                    <RankBadge rank={index + 1} size={32} />
                    <div className="flex-1 pb-0.5 flex flex-col gap-0.5">
                      <div className="self-stretch flex flex-col text-greyscale-blue-100 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                        {team.playerName}
                      </div>
                      <div className={`self-stretch flex flex-col text-sm font-brockmann font-normal leading-5 ${
                        isSelected ? 'text-greyscale-blue-100' : 'text-greyscale-blue-300'
                      }`}>
                        {(() => {
                          const topMovie = team.picks
                            .filter(pick => (pick as any).calculated_score > 0)
                            .sort((a, b) => (b as any).calculated_score - (a as any).calculated_score)[0];
                          return topMovie ? `Top Movie: ${topMovie.movie_title}` : `${team.completedPicks}/${team.totalPicks} movies scored`;
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-right flex flex-col text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px] ${
                        isSelected ? 'text-greyscale-blue-100' : 'text-purple-300'
                      }`}>
                        {team.averageScore.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
