import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ShareIcon, CopyIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { downloadImage } from '@/utils/imageGenerator';
import { useSVGImageRenderer } from '@/hooks/useSVGImageRenderer';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { calculateDetailedScore } from '@/utils/scoreCalculator';

interface TeamScore {
  playerName: string;
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface Pick {
  movie_title: string;
  calculated_score?: number;
  player_name: string;
}

interface ShareResultsButtonProps {
  draftTitle: string;
  teamScores: TeamScore[];
  picks: Pick[];
  draftId: string;
  isPublicView?: boolean;
}

const ShareResultsButton: React.FC<ShareResultsButtonProps> = ({
  draftTitle,
  teamScores,
  picks,
  draftId,
  isPublicView = false
}) => {
  const [generating, setGenerating] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { toast } = useToast();
  const { makeDraftPublic } = useDraftOperations();
  const { renderToCanvas } = useSVGImageRenderer();

  const handleDownloadImage = async () => {
    try {
      setGenerating(true);
      
      // Recalculate scores for all picks using current calculation logic
      const moviesWithScores = picks
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
            return {
              title: pick.movie_title,
              score: scoreBreakdown.finalScore,
              playerName: pick.player_name,
              poster: pickWithScoring.poster_path ? `https://image.tmdb.org/t/p/w500${pickWithScoring.poster_path}` : undefined,
              year: pickWithScoring.movie_year,
              genre: pickWithScoring.movie_genre,
              category: pickWithScoring.category,
              pickNumber: pickWithScoring.pick_order
            };
          }
          return null;
        })
        .filter((movie): movie is NonNullable<typeof movie> => movie !== null);
      
      const bestMovie = moviesWithScores.length > 0 
        ? moviesWithScores.reduce((best, current) => 
            current.score > best.score ? current : best
          )
        : undefined;

      // Find the first pick (pick_order === 1) and recalculate its score
      const firstPickData = picks.find(pick => (pick as any).pick_order === 1);
      const firstPick = firstPickData ? (() => {
        const pickWithScoring = firstPickData as any;
        let recalculatedScore = 0;
        
        // Recalculate score if we have scoring data
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
          recalculatedScore = scoreBreakdown.finalScore;
        }
        
        return {
          title: firstPickData.movie_title,
          score: recalculatedScore,
          playerName: firstPickData.player_name,
          poster: pickWithScoring.poster_path ? `https://image.tmdb.org/t/p/w500${pickWithScoring.poster_path}` : undefined,
          year: pickWithScoring.movie_year,
          genre: pickWithScoring.movie_genre,
          category: pickWithScoring.category,
          pickNumber: pickWithScoring.pick_order
        };
      })() : undefined;

      const draftData = {
        title: draftTitle,
        teamScores,
        totalMovies: picks.length,
        bestMovie,
        firstPick
      };

      console.log('Draft data being sent to renderer:', draftData);
      const imageDataUrl = await renderToCanvas(draftData);
      const filename = `${draftTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_final_scores.png`;
      
      downloadImage(imageDataUrl, filename);
      
      toast({
        title: "Image Generated!",
        description: "Your final scores image has been downloaded successfully."
      });
    } catch (error) {
      console.error('Error generating share image:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate the share image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPublicLink = async () => {
    try {
      // First make the draft public
      await makeDraftPublic(draftId);
      
      const publicUrl = `${window.location.origin}/final-scores/${draftId}?public=true`;
      navigator.clipboard.writeText(publicUrl);
      toast({
        title: "Link Copied!",
        description: "Public link copied to clipboard"
      });
    } catch (error) {
      console.error('Error making draft public:', error);
      toast({
        title: "Error",
        description: "Failed to create public link",
        variant: "destructive"
      });
    }
  };

  const handleShareClick = () => {
    setShowShareMenu(!showShareMenu);
  };

  const buttonBaseStyle = {
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '12px',
    paddingBottom: '12px',
    borderRadius: '2px',
    outline: '1px solid',
    outlineOffset: '-1px',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    display: 'inline-flex',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const textStyle = {
    textAlign: 'center' as const,
    justifyContent: 'center' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    color: 'var(--Text-Primary, #FCFFFF)',
    fontSize: '16px',
    fontFamily: 'Brockmann',
    fontWeight: '600',
    lineHeight: '24px',
    letterSpacing: '0.32px',
    wordWrap: 'break-word' as const
  };

  const iconContainerStyle = {
    width: '24px',
    height: '24px',
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    display: 'inline-flex' as const
  };

  const DownloadIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.29302 10.2071C5.90249 9.81658 5.90249 9.18357 6.29302 8.79304C6.68354 8.40252 7.31655 8.40252 7.70708 8.79304L12 13.086L16.293 8.79304L16.3692 8.72468C16.762 8.40433 17.341 8.42693 17.7071 8.79304C18.0732 9.15916 18.0958 9.73816 17.7754 10.1309L17.7071 10.2071L12.7071 15.2071C12.3166 15.5976 11.6835 15.5976 11.293 15.2071L6.29302 10.2071Z" fill="#FCFFFF"/>
      <path d="M11 4.50008L11.0049 4.39754C11.0563 3.89341 11.4824 3.50008 12 3.50008C12.5177 3.50008 12.9438 3.89341 12.9952 4.39754L13 4.50008V13.5001C13 14.0524 12.5523 14.5001 12 14.5001C11.4478 14.5001 11 14.0524 11 13.5001V4.50008Z" fill="#FCFFFF"/>
      <path d="M3 17.4999V15.4999C3 14.9477 3.44772 14.4999 4 14.4999C4.55228 14.4999 5 14.9477 5 15.4999V17.4999C5 17.6747 5.09738 17.9333 5.33203 18.1679C5.56669 18.4026 5.82523 18.4999 6 18.4999H18C18.1748 18.4999 18.4333 18.4026 18.668 18.1679C18.9026 17.9333 19 17.6747 19 17.4999V15.4999C19 14.9477 19.4477 14.4999 20 14.4999C20.5523 14.4999 21 14.9477 21 15.4999V17.4999C21 18.3252 20.5974 19.0666 20.082 19.582C19.5667 20.0973 18.8252 20.4999 18 20.4999H6C5.17477 20.4999 4.43331 20.0973 3.91797 19.582C3.40262 19.0666 3 18.3252 3 17.4999Z" fill="#FCFFFF"/>
    </svg>
  );

  return (
    <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-[10px] w-full md:w-auto">
      <button
        onClick={handleShareClick}
        disabled={generating || teamScores.length === 0}
        onMouseEnter={(e) => {
          if (!showShareMenu) {
            e.currentTarget.style.background = 'var(--UI-Primary-Hover, #2C2B2D)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showShareMenu) {
            e.currentTarget.style.background = 'var(--UI-Primary, #1D1D1F)';
          }
        }}
        className="w-full md:w-auto"
        style={{
          ...buttonBaseStyle,
          background: showShareMenu 
            ? 'var(--Brand-Primary, #7142FF)' 
            : 'var(--UI-Primary, #1D1D1F)',
          outline: showShareMenu
            ? '1px var(--Brand-Primary, #7142FF) solid'
            : '1px var(--Button-Stroke, #666469) solid'
        }}
      >
        <div style={iconContainerStyle}>
          {generating ? (
            <RefreshCw size={24} className="animate-spin" style={{ color: '#FCFFFF', width: '24px', height: '24px' }} />
          ) : (
            <ShareIcon className="" style={{ width: '24px', height: '24px', color: '#FCFFFF' }} />
          )}
        </div>
        <div style={textStyle}>
          {generating ? 'Generating...' : 'Share Results'}
        </div>
      </button>

      {showShareMenu && (
        <>
          <button
            onClick={handleDownloadImage}
            disabled={generating}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--UI-Primary-Hover, #2C2B2D)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--UI-Primary, #1D1D1F)';
            }}
            className="w-full md:w-auto"
            style={{
              ...buttonBaseStyle,
              background: 'var(--UI-Primary, #1D1D1F)',
              outline: '1px var(--Button-Stroke, #666469) solid'
            }}
          >
            <div style={iconContainerStyle}>
              <DownloadIcon />
            </div>
            <div style={textStyle}>
              Download Image
            </div>
          </button>

          <button
            onClick={handleCopyPublicLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--UI-Primary-Hover, #2C2B2D)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--UI-Primary, #1D1D1F)';
            }}
            className="w-full md:w-auto"
            style={{
              ...buttonBaseStyle,
              background: 'var(--UI-Primary, #1D1D1F)',
              outline: '1px var(--Button-Stroke, #666469) solid'
            }}
          >
            <div style={iconContainerStyle}>
              <CopyIcon style={{ width: '20px', height: '20px', color: '#FCFFFF' }} />
            </div>
            <div style={textStyle}>
              Copy Public Link
            </div>
          </button>
        </>
      )}
    </div>
  );
};

export default ShareResultsButton;
