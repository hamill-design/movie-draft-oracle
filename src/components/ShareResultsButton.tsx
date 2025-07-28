
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share, Download, RefreshCw, Copy, Link } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { generateShareImage, downloadImage } from '@/utils/imageGenerator';
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

  const handleShareResults = async () => {
    try {
      setGenerating(true);
      
      // Find the best scoring movie
      const moviesWithScores = picks
        .filter(pick => (pick as any).calculated_score !== null && (pick as any).calculated_score !== undefined)
        .map(pick => ({
          title: pick.movie_title,
          score: (pick as any).calculated_score!,
          playerName: pick.player_name
        }));
      
      const bestMovie = moviesWithScores.length > 0 
        ? moviesWithScores.reduce((best, current) => 
            current.score > best.score ? current : best
          )
        : undefined;

      const draftData = {
        title: draftTitle,
        teamScores,
        totalMovies: picks.length,
        bestMovie
      };

      const imageDataUrl = await generateShareImage(draftData);
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
        <Button
          disabled={generating || teamScores.length === 0}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          size="lg"
        >
          {generating ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Share size={20} />
              Share Results
            </>
          )}
        </Button>
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
