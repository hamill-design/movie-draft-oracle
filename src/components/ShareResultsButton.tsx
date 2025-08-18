import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Copy, Link } from 'lucide-react';
import { ShareIcon } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { downloadImage } from '@/utils/imageGenerator';
import { useSVGImageRenderer } from '@/hooks/useSVGImageRenderer';
import { useDraftOperations } from '@/hooks/useDraftOperations';

interface TeamScore {
  playerName: string;
  totalScore: number;
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

  const handleShareResults = async () => {
    try {
      setGenerating(true);
      
      // Find the best scoring movie
      const moviesWithScores = picks
        .filter(pick => (pick as any).calculated_score !== null && (pick as any).calculated_score !== undefined)
        .map(pick => ({
          title: pick.movie_title,
          score: (pick as any).calculated_score!,
          playerName: pick.player_name,
          poster: (pick as any).poster_path ? `https://image.tmdb.org/t/p/w500${(pick as any).poster_path}` : undefined,
          year: (pick as any).movie_year,
          genre: (pick as any).movie_genre,
          category: (pick as any).category,
          pickNumber: (pick as any).pick_order
        }));
      
      const bestMovie = moviesWithScores.length > 0 
        ? moviesWithScores.reduce((best, current) => 
            current.score > best.score ? current : best
          )
        : undefined;

      // Find the first pick (pick_order === 1)
      const firstPickData = picks.find(pick => (pick as any).pick_order === 1);
      const firstPick = firstPickData ? {
        title: firstPickData.movie_title,
        score: (firstPickData as any).calculated_score || 0,
        playerName: firstPickData.player_name,
        poster: (firstPickData as any).poster_path ? `https://image.tmdb.org/t/p/w500${(firstPickData as any).poster_path}` : undefined,
        year: (firstPickData as any).movie_year,
        genre: (firstPickData as any).movie_genre,
        category: (firstPickData as any).category,
        pickNumber: (firstPickData as any).pick_order
      } : undefined;

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
    setShowShareMenu(false);
  };

  return (
    <Popover open={showShareMenu} onOpenChange={setShowShareMenu}>
      <PopoverTrigger asChild>
        <button
          disabled={generating || teamScores.length === 0}
          style={{
            width: '100%',
            height: '100%',
            paddingLeft: '24px',
            paddingRight: '24px',
            paddingTop: '12px',
            paddingBottom: '12px',
            background: 'var(--UI-Primary, white)',
            borderRadius: '2px',
            outline: '1px hsl(var(--greyscale-blue-200)) solid',
            outlineOffset: '-1px',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            display: 'inline-flex',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'hsl(var(--purple-100))';
            e.currentTarget.style.outline = '1px hsl(var(--purple-200)) solid';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--UI-Primary, white)';
            e.currentTarget.style.outline = '1px hsl(var(--greyscale-blue-200)) solid';
          }}
        >
          <div style={{
            width: '24px',
            height: '24px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            display: 'inline-flex'
          }}>
            {generating ? (
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--Greyscale-(Blue)-800, #2B2D2D)' }} />
            ) : (
              <ShareIcon className="text-foreground" />
            )}
          </div>
          <div style={{
            textAlign: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--Text-Primary, #2B2D2D)',
            fontSize: '16px',
            fontFamily: 'Brockmann',
            fontWeight: '600',
            lineHeight: '24px',
            letterSpacing: '0.32px',
            wordWrap: 'break-word'
          }}>
            {generating ? 'Generating...' : 'Share Results'}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" align="end">
        <div className="space-y-2">
          <Button
            onClick={handleShareResults}
            disabled={generating}
            variant="outline"
            className="w-full justify-start"
          >
            <Download size={16} className="mr-2" />
            Download Image
          </Button>
          
          <Button
            onClick={handleCopyPublicLink}
            variant="outline"
            className="w-full justify-start"
          >
            <Link size={16} className="mr-2" />
            Copy Public Link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShareResultsButton;
