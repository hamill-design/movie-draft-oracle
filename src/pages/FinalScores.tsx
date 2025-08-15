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

  const getRankingBadgeStyle = (index: number) => {
    const rank = index + 1;
    
    if (rank === 1) {
      // Gold - 1st place
      return {
        background: 'var(--Yellow-500, #FFD60A)',
        outline: '2px var(--Yellow-200, #FFF2B2) solid',
        outlineOffset: '-2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 2) {
      // Silver - 2nd place
      return {
        background: 'var(--Greyscale-300, #CCCCCC)',
        outline: '2px var(--Greyscale-200, #E5E5E5) solid',
        outlineOffset: '-2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
      };
    } else if (rank === 3) {
      // Bronze - 3rd place
      return {
        background: '#DE7E3E',
        outline: '2px #FFAE78 solid',
        outlineOffset: '-2px',
        color: 'var(--Greyscale-(Blue)-800, #2B2D2D)'
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
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
    <div className="min-h-screen" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
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
          <div style={{
            width: '100%',
            height: '100%',
            padding: '24px',
            background: 'var(--Greyscale-(Blue)-100, #FCFFFF)',
            boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)',
            borderRadius: '4px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '24px',
            display: 'inline-flex'
          }}>
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              display: 'flex'
            }}>
              <div style={{
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #2B2D2D)',
                fontSize: '24px',
                fontFamily: 'Brockmann',
                fontWeight: '700',
                lineHeight: '32px',
                letterSpacing: '0.96px',
                wordWrap: 'break-word'
              }}>
                FINAL SCORES
              </div>
            </div>
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px',
              display: 'flex'
            }}>
              {teamScores.map((team, index) => {
                const badgeStyle = getRankingBadgeStyle(index);
                return (
                  <div
                    key={team.playerName}
                    onClick={() => setSelectedTeam(team.playerName)}
                    style={{
                      alignSelf: 'stretch',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      paddingLeft: '16px',
                      paddingRight: '24px',
                      background: selectedTeam === team.playerName ? 'var(--Purple-100, #EDEBFF)' : 'var(--UI-Primary, white)',
                      borderRadius: '8px',
                      outline: selectedTeam === team.playerName ? '1px var(--Purple-200, #BCB2FF) solid' : '1px var(--Greyscale-(Blue)-200, #D9E0DF) solid',
                      outlineOffset: '-1px',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: '16px',
                      display: 'inline-flex',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      ...badgeStyle,
                      borderRadius: '9999px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      display: 'flex'
                    }}>
                      <div style={{
                        textAlign: 'center',
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: badgeStyle.color,
                        fontSize: '16px',
                        fontFamily: 'Brockmann',
                        fontWeight: '700',
                        lineHeight: '24px',
                        wordWrap: 'break-word'
                      }}>
                        {index + 1}
                      </div>
                    </div>
                    <div style={{
                      flex: '1 1 0',
                      paddingBottom: '2px',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: '2px',
                      display: 'inline-flex'
                    }}>
                      <div style={{
                        alignSelf: 'stretch',
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: selectedTeam === team.playerName ? 'var(--Greyscale-(Blue)-800, #2B2D2D)' : 'var(--Text-Primary, #2B2D2D)',
                        fontSize: '16px',
                        fontFamily: 'Brockmann',
                        fontWeight: '600',
                        lineHeight: '24px',
                        letterSpacing: '0.32px',
                        wordWrap: 'break-word'
                      }}>
                        {team.playerName}
                      </div>
                      <div style={{
                        alignSelf: 'stretch',
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: selectedTeam === team.playerName ? 'var(--Greyscale-(Blue)-800, #2B2D2D)' : 'var(--Text-Primary, #2B2D2D)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '400',
                        lineHeight: '20px',
                        wordWrap: 'break-word'
                      }}>
                        {team.completedPicks}/{team.totalPicks} movies scored
                      </div>
                    </div>
                    <div style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      display: 'inline-flex'
                    }}>
                      <div style={{
                        alignSelf: 'stretch',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-end',
                        display: 'flex'
                      }}>
                        <div style={{
                          textAlign: 'right',
                          justifyContent: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          color: 'var(--Brand-Primary, #680AFF)',
                          fontSize: '32px',
                          fontFamily: 'Brockmann',
                          fontWeight: '500',
                          lineHeight: '36px',
                          letterSpacing: '1.28px',
                          wordWrap: 'break-word'
                        }}>
                          {team.totalScore.toFixed(1)}
                        </div>
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
