import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
import { getScoreColor, getScoreGrade, calculateDetailedScore } from '@/utils/scoreCalculator';
import RankBadge from '@/components/RankBadge';
import { storePendingDraft } from '@/utils/draftStorage';

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
  const location = useLocation();
  const { user, loading, isGuest } = useAuth();
  const { getDraftWithPicks, autoSaveDraft } = useDraftOperations();
  const { toast } = useToast();
  
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [enrichingScores, setEnrichingScores] = useState(false);
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
      
      // Check location state first - if draft data was passed via navigation, use it
      const stateData = location.state as any;
      if (stateData?.draftData && stateData?.picks) {
        // Use data from navigation state - no database query needed
        console.log('Using draft data from navigation state', {
          draftData: stateData.draftData,
          picksCount: stateData.picks?.length,
          firstPick: stateData.picks?.[0],
          picksSample: stateData.picks?.slice(0, 3)
        });
        setDraft(stateData.draftData);
        setPicks(stateData.picks);
        
        // Process initial team scores (may have 0 scores if no scoring data yet)
        const teams = processTeamScores(stateData.picks || []);
        console.log('Processed team scores:', teams);
        setTeamScores(teams);
        if (teams.length > 0) {
          setSelectedTeam(teams[0].playerName);
        }
        setLoadingData(false);
        
        // Check if picks need enrichment (don't have scoring data)
        const needsEnrichment = stateData.picks?.some((pick: any) => 
          !pick.calculated_score && (!pick.rt_critics_score && !pick.imdb_rating && !pick.metacritic_score)
        );
        
        if (needsEnrichment) {
          // Enrich in background and update state
          autoEnrichMovieData(stateData.picks).catch(err => {
            console.error('Background enrichment failed:', err);
          });
        }
        
        return;
      }
      
      // Check localStorage for local drafts (fallback when database save failed)
      if (draftId) {
        try {
          const localDraftKey = `local_draft_${draftId}`;
          const localDraftJson = localStorage.getItem(localDraftKey);
          if (localDraftJson) {
            const localDraft = JSON.parse(localDraftJson);
            if (localDraft.isLocal && localDraft.picks) {
              console.log('Using local draft data from localStorage');
              setDraft({
                id: localDraft.id,
                title: localDraft.option || localDraft.title,
                theme: localDraft.theme,
                option: localDraft.option,
                participants: localDraft.participants,
                categories: localDraft.categories,
                is_complete: localDraft.isComplete || localDraft.is_complete,
                isLocal: true
              });
              // Convert picks to DraftPick format, preserving scoring data
              const formattedPicks = localDraft.picks.map((pick: any, index: number) => {
                const pickWithScoring = pick as any;
                return {
                  id: pick.movie?.id || `local_${index}`,
                  draft_id: localDraft.id,
                  player_id: pick.playerId,
                  player_name: pick.playerName,
                  movie_id: pick.movie?.id || '',
                  movie_title: pick.movie?.title || '',
                  movie_year: pick.movie?.year || null,
                  movie_genre: pick.movie?.genre || 'Unknown',
                  category: pick.category,
                  pick_order: pick.pick_order || index + 1,
                  poster_path: pick.movie?.posterPath || pick.movie?.poster_path || null,
                  // Preserve scoring data if available
                  calculated_score: pickWithScoring.calculated_score ?? null,
                  rt_critics_score: pickWithScoring.rt_critics_score ?? null,
                  rt_audience_score: pickWithScoring.rt_audience_score ?? null,
                  imdb_rating: pickWithScoring.imdb_rating ?? null,
                  metacritic_score: pickWithScoring.metacritic_score ?? null,
                  movie_budget: pickWithScoring.movie_budget ?? null,
                  movie_revenue: pickWithScoring.movie_revenue ?? null,
                  oscar_status: pickWithScoring.oscar_status ?? null,
                  scoring_data_complete: pickWithScoring.scoring_data_complete ?? false
                };
              });
              setPicks(formattedPicks);
              const teams = processTeamScores(formattedPicks);
              setTeamScores(teams);
              if (teams.length > 0) {
                setSelectedTeam(teams[0].playerName);
              }
              setLoadingData(false);
              
              // Always enrich movies when loading from localStorage (they may be missing scores)
              autoEnrichMovieData(formattedPicks).catch(err => {
                console.error('Background enrichment failed:', err);
              });
              
              return;
            }
          }
        } catch (localError) {
          console.error('Error loading local draft:', localError);
          // Continue to try database fetch
        }
      }
      
      // Otherwise, fetch from database
      // For public views, use the "Anyone can view completed drafts" RLS policy
      // Query for completed drafts - this should work without authentication
      if (isPublicView) {
        const { data: publicDraft, error: draftError } = await supabase
          .from('drafts')
          .select('*')
          .eq('id', draftId!)
          .eq('is_complete', true)  // Filter by is_complete to match the RLS policy
          .single();
          
        if (draftError) {
          console.error('Failed to load completed draft:', {
            error: draftError,
            draftId,
            code: draftError.code,
            message: draftError.message
          });
          throw new Error('Failed to load public draft data');
        }
        
        const { data: publicPicks, error: picksError } = await supabase
          .from('draft_picks')
          .select('*')
          .eq('draft_id', draftId!)
          .order('pick_order');
          
        if (picksError) {
          console.error('Failed to load picks:', {
            error: picksError,
            draftId,
            code: picksError.code,
            message: picksError.message
          });
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

    // Check for movies that need enrichment:
    // - Missing calculated_score (most important)
    // - Missing RT/IMDB/Metacritic data
    // - Missing poster_path
    const moviesToEnrich = picksData.filter(pick => {
      const pickWithScoring = pick as any;
      // Always enrich if calculated_score is missing or 0
      if (!pickWithScoring.calculated_score || pickWithScoring.calculated_score === 0) {
        return true;
      }
      // Also enrich if missing key scoring data or poster
      return !pickWithScoring.rt_critics_score || !pickWithScoring.imdb_rating || !pickWithScoring.metacritic_score || !pickWithScoring.poster_path;
    });
    
    console.log('Auto-enriching movies:', moviesToEnrich.length, 'Total picks:', picksData.length);
    
    if (moviesToEnrich.length === 0) {
      console.log('All movies already have scoring data');
      return;
    }

    // Set loading state for enrichment
    setEnrichingScores(true);

    // Silently enrich in background
    try {
      // Create a copy of picks to update
      const enrichedPicks = [...picksData];
      
      // Process movies one by one to avoid rate limiting
      for (let i = 0; i < moviesToEnrich.length; i++) {
        const pick = moviesToEnrich[i];
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
        } else if (data?.enrichmentData || data?.success) {
          console.log(`Successfully enriched ${pick.movie_title}:`, data);
          
          // Find the pick in our array and update it
          const pickIndex = enrichedPicks.findIndex(p => p.id === pick.id);
          if (pickIndex !== -1) {
            const enrichmentData = data.enrichmentData || data;
            const enrichedPick = enrichedPicks[pickIndex] as any;
            
            enrichedPick.rt_critics_score = enrichmentData.rtCriticsScore || enrichmentData.rt_critics_score || enrichedPick.rt_critics_score || null;
            enrichedPick.metacritic_score = enrichmentData.metacriticScore || enrichmentData.metacritic_score || enrichedPick.metacritic_score || null;
            enrichedPick.imdb_rating = enrichmentData.imdbRating || enrichmentData.imdb_rating || enrichedPick.imdb_rating || null;
            enrichedPick.movie_budget = enrichmentData.budget || enrichmentData.movie_budget || enrichedPick.movie_budget || null;
            enrichedPick.movie_revenue = enrichmentData.revenue || enrichmentData.movie_revenue || enrichedPick.movie_revenue || null;
            enrichedPick.oscar_status = enrichmentData.oscarStatus || enrichmentData.oscar_status || enrichedPick.oscar_status || null;
            enrichedPick.poster_path = enrichmentData.posterPath || enrichmentData.poster_path || enrichedPick.poster_path || null;
            
            // Use calculatedScore from response, or calculate it ourselves if missing
            let calculatedScore = enrichmentData.calculatedScore || enrichmentData.calculated_score;
            
            if (!calculatedScore && (enrichedPick.rt_critics_score || enrichedPick.imdb_rating || enrichedPick.metacritic_score)) {
              // Calculate score manually if not provided using consensus scoring
              
              // Box Office - Hybrid ROI-based formula
              let boxOfficeScore = 0;
              if (enrichedPick.movie_budget && enrichedPick.movie_revenue && enrichedPick.movie_budget > 0) {
                const profit = enrichedPick.movie_revenue - enrichedPick.movie_budget;
                if (profit <= 0) {
                  boxOfficeScore = 0; // Flops get 0
                } else {
                  const roiPercent = (profit / enrichedPick.movie_budget) * 100;
                  if (roiPercent <= 100) {
                    // Linear scaling: 0-100% ROI → 0-60 points (2x return = 60 points)
                    boxOfficeScore = 60 * (roiPercent / 100);
                  } else {
                    // Logarithmic scaling: >100% ROI → 60-100 points (diminishing returns)
                    boxOfficeScore = 60 + 40 * (1 - Math.exp(-(roiPercent - 100) / 200));
                  }
                }
              }
              
              // Convert scores to 0-100 scale
              const rtCriticsScore = enrichedPick.rt_critics_score || 0;
              const metacriticScore = enrichedPick.metacritic_score || 0;
              const imdbScore = enrichedPick.imdb_rating ? (enrichedPick.imdb_rating / 10) * 100 : 0;
              
              // Layer 1: Calculate Critics Score (Internal Consensus)
              let criticsRawAvg = 0;
              let criticsScore = 0;
              if (rtCriticsScore && metacriticScore) {
                criticsRawAvg = (rtCriticsScore + metacriticScore) / 2;
                const criticsInternalDiff = Math.abs(rtCriticsScore - metacriticScore);
                const criticsInternalModifier = Math.max(0, 1 - (criticsInternalDiff / 200));
                criticsScore = criticsRawAvg * criticsInternalModifier;
              } else if (rtCriticsScore) {
                criticsRawAvg = rtCriticsScore;
                criticsScore = rtCriticsScore;
              } else if (metacriticScore) {
                criticsRawAvg = metacriticScore;
                criticsScore = metacriticScore;
              }
              
              // Layer 2: Calculate Audience Score (IMDB only, no Letterboxd)
              let audienceRawAvg = 0;
              let audienceScore = 0;
              if (imdbScore) {
                audienceRawAvg = imdbScore;
                audienceScore = imdbScore;
              }
              
              // Layer 3: Calculate Final Critical Score (Cross-Category Consensus)
              let criticalScore = 0;
              if (criticsRawAvg > 0 && audienceRawAvg > 0) {
                // Use RAW averages for consensus calculation
                const criticsAudienceDiff = Math.abs(criticsRawAvg - audienceRawAvg);
                const consensusModifier = Math.max(0, 1 - (criticsAudienceDiff / 200));
                
                // Weighted average of penalized scores (50/50)
                const weightedAvg = (criticsScore * 0.5) + (audienceScore * 0.5);
                criticalScore = weightedAvg * consensusModifier;
              } else if (criticsScore > 0) {
                criticalScore = criticsScore;
              } else if (audienceScore > 0) {
                criticalScore = audienceScore;
              }
              
              // Fixed weights: 20% Box Office, 80% Critical Score
              let boxOfficeWeight = 0.20;
              let criticalWeight = 0.80;
              
              if (boxOfficeScore > 0 && criticalScore > 0) {
                // Both available: use fixed 20/80 split
                boxOfficeWeight = 0.20;
                criticalWeight = 0.80;
              } else if (boxOfficeScore > 0) {
                // Only Box Office available
                boxOfficeWeight = 1.0;
                criticalWeight = 0;
              } else if (criticalScore > 0) {
                // Only Critical Score available
                boxOfficeWeight = 0;
                criticalWeight = 1.0;
              }
              
              // Calculate final average with fixed weights
              let averageScore = 0;
              if (boxOfficeScore > 0 && criticalScore > 0) {
                averageScore = (boxOfficeScore * boxOfficeWeight) + (criticalScore * criticalWeight);
              } else if (boxOfficeScore > 0) {
                averageScore = boxOfficeScore;
              } else if (criticalScore > 0) {
                averageScore = criticalScore;
              }
              
              // Add Oscar bonus
              let oscarBonus = 0;
              if (enrichedPick.oscar_status === 'winner') {
                oscarBonus = 6;
              } else if (enrichedPick.oscar_status === 'nominee') {
                oscarBonus = 3;
              }
              
              calculatedScore = Math.round((averageScore + oscarBonus) * 100) / 100;
            }
            
            enrichedPick.calculated_score = calculatedScore || null;
            enrichedPick.scoring_data_complete = enrichmentData.scoringComplete !== undefined 
              ? enrichmentData.scoringComplete 
              : (enrichmentData.scoring_data_complete !== undefined ? enrichmentData.scoring_data_complete : false);
            
            console.log(`Updated ${pick.movie_title} - calculated_score:`, enrichedPick.calculated_score);
          }
        }

        // Small delay to avoid overwhelming the APIs
        if (i < moviesToEnrich.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update state with enriched picks (don't try to fetch from database for local drafts)
      setPicks(enrichedPicks);

      // Recalculate team scores with enriched data
      const refreshedTeams = processTeamScores(enrichedPicks);
      setTeamScores(refreshedTeams);
      
      console.log('Updated picks with scores:', enrichedPicks.map((p: any) => ({
        title: p.movie_title,
        calculated_score: p.calculated_score
      })));

    } catch (error) {
      console.error('Error auto-enriching movie data:', error);
    } finally {
      // Clear loading state when enrichment completes
      setEnrichingScores(false);
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
      // Recalculate scores for each pick using current calculation logic
      const recalculatedScores = playerPicks
        .map(pick => {
          const pickWithScoring = pick as any;
          // Only recalculate if we have scoring data
          if (pickWithScoring.movie_budget || pickWithScoring.rt_critics_score || 
              pickWithScoring.imdb_rating || pickWithScoring.metacritic_score) {
            const scoringData = {
              budget: pickWithScoring.movie_budget,
              revenue: pickWithScoring.movie_revenue,
              rtCriticsScore: pickWithScoring.rt_critics_score,
              rtAudienceScore: pickWithScoring.rt_audience_score,
              metacriticScore: pickWithScoring.metacritic_score,
              imdbRating: pickWithScoring.imdb_rating,
              oscarStatus: pickWithScoring.oscar_status
            };
            const scoreBreakdown = calculateDetailedScore(scoringData);
            return scoreBreakdown.finalScore;
          }
          return null;
        })
        .filter((score): score is number => score !== null && score !== undefined);
      
      // DEBUG: Log detailed calculation for each player
      console.log(`\n=== Score Calculation Debug: ${playerName} ===`);
      console.log(`Total picks: ${playerPicks.length}`);
      console.log(`Recalculated scores:`, recalculatedScores);
      console.log(`Number of valid scores: ${recalculatedScores.length}`);
      
      const sum = recalculatedScores.reduce((sum: number, score: number) => sum + score, 0);
      console.log(`Sum of recalculated scores: ${sum.toFixed(2)}`);
      
      const averageScore = recalculatedScores.length > 0 
        ? recalculatedScores.reduce((sum: number, score: number) => sum + score, 0) / recalculatedScores.length
        : 0;
      
      console.log(`Calculated average: ${averageScore.toFixed(2)}`);
      console.log(`Calculation: (${recalculatedScores.join(' + ')}) / ${recalculatedScores.length} = ${averageScore.toFixed(2)}`);
      console.log(`=== End Debug: ${playerName} ===\n`);

      teams.push({
        playerName,
        picks: playerPicks,
        averageScore,
        completedPicks: recalculatedScores.length,
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

  const handleAuthRedirect = async () => {
    toast({
      title: "Create Account",
      description: "Sign up to save drafts permanently and access them from any device."
    });

    const draftData = getDraftDataForSave();
    if (!draftData) {
      console.error('No draft data available to save');
      navigate('/auth');
      return;
    }

    const returnPath = `/final-scores/${draftId}`;
    let savedDraftId = draftId || null;

    // Try to save draft to database if not already saved
    // Check if draft exists in database by trying to fetch it
    if (draftId) {
      try {
        const { data: existingDraft } = await supabase
          .from('drafts')
          .select('id')
          .eq('id', draftId)
          .maybeSingle();

        if (!existingDraft) {
          // Draft doesn't exist in DB, try to save it
          try {
            savedDraftId = await autoSaveDraft(draftData, undefined);
            console.log('Saved draft to database before redirect:', savedDraftId);
          } catch (saveError) {
            console.warn('Failed to save draft to database before redirect:', saveError);
            // Continue anyway - will rely on localStorage backup
          }
        } else {
          // Draft exists, might need to update it
          try {
            await autoSaveDraft(draftData, draftId);
            console.log('Updated draft in database before redirect:', draftId);
          } catch (updateError) {
            console.warn('Failed to update draft in database before redirect:', updateError);
            // Continue anyway - will rely on localStorage backup
          }
        }
      } catch (checkError) {
        console.warn('Failed to check if draft exists in database:', checkError);
        // Continue anyway - will rely on localStorage backup
      }
    } else {
      // No draftId, try to create new draft
      try {
        savedDraftId = await autoSaveDraft(draftData, undefined);
        console.log('Created draft in database before redirect:', savedDraftId);
      } catch (createError) {
        console.warn('Failed to create draft in database before redirect:', createError);
        // Continue anyway - will rely on localStorage backup
      }
    }

    // Store draft in localStorage as backup
    storePendingDraft(draftData, savedDraftId, returnPath);

    // Navigate to auth page with return path and save flag
    const authUrl = `/auth?returnTo=${encodeURIComponent(returnPath)}&saveDraft=true`;
    navigate(authUrl);
  };

  const getDraftDataForSave = () => {
    if (!draft) return null;
    
    return {
      title: draft.title,
      theme: draft.theme,
      option: draft.option,
      participants: draft.participants,
      categories: draft.categories,
      picks: picks.map(pick => {
        const pickWithScoring = pick as any;
        return {
          playerId: pick.player_id,
          playerName: pick.player_name,
          movie: {
            id: pick.movie_id,
            title: pick.movie_title,
            year: pick.movie_year,
            genre: pick.movie_genre,
            posterPath: pick.poster_path
          },
          category: pick.category,
          // Include scoring data if available
          calculated_score: pickWithScoring.calculated_score ?? null,
          rt_critics_score: pickWithScoring.rt_critics_score ?? null,
          rt_audience_score: pickWithScoring.rt_audience_score ?? null,
          imdb_rating: pickWithScoring.imdb_rating ?? null,
          metacritic_score: pickWithScoring.metacritic_score ?? null,
          movie_budget: pickWithScoring.movie_budget ?? null,
          movie_revenue: pickWithScoring.movie_revenue ?? null,
          oscar_status: pickWithScoring.oscar_status ?? null,
          scoring_data_complete: pickWithScoring.scoring_data_complete ?? false
        };
      }),
      isComplete: draft.is_complete
    };
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>
          Loading...
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

  const pageTitle = draft?.title ? `Movie Drafter - ${draft.title} Final Scores` : 'Movie Drafter - Final Scores';
  const pageDescription = draft?.title 
    ? `View the final scores for ${draft.title} movie draft. See who picked the best movies and compare your results.`
    : 'View the final scores for your movie draft. See who picked the best movies and compare your results.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={`https://moviedrafter.com/final-scores/${draftId}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={`https://moviedrafter.com/final-scores/${draftId}`} />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
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
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-3 mb-8">
          {/* Save Draft Button for Guest Users and Anonymous Viewers */}
          {(isGuest || isPublicView) && !user && (
            <Button
              onClick={handleAuthRedirect}
              className="bg-yellow-400 hover:bg-yellow-500 text-black w-full md:w-auto !h-auto"
              style={{
                fontSize: '16px',
                fontFamily: 'Brockmann',
                fontWeight: '600',
                lineHeight: '24px',
                letterSpacing: '0.32px',
                alignSelf: 'stretch',
                height: 'auto'
              }}
            >
              Login to Save
            </Button>
          )}
          
          {/* Save Draft Button - only show for guests (not logged in) */}
          {!user && !isPublicView && getDraftDataForSave() && (
            <SaveDraftButton draftData={getDraftDataForSave()!} />
          )}
          
          {/* Share Results Button */}
          {teamScores.length > 0 && (
            <ShareResultsButton
              draftTitle={draft.title}
              teamScores={teamScores}
              picks={picks}
              draftId={draftId!}
              isPublicView={isPublicView}
            />
          )}
        </div>



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
                      <div className={`text-right flex flex-col items-end text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px] ${
                        isSelected ? 'text-greyscale-blue-100' : 'text-purple-300'
                      }`}>
                        {enrichingScores && team.averageScore === 0 ? (
                          <RefreshCw className="animate-spin" size={28} />
                        ) : (
                          team.averageScore.toFixed(2)
                        )}
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
    </>
  );
};

export default FinalScores;
