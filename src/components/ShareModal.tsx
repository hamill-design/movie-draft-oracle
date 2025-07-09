import React, { useState, useRef } from 'react';
import { X, Download, Share2, Facebook, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ShareCard from './ShareCard';
import { generateShareText, generateImageShareText, generateFacebookShareUrl } from '@/utils/shareUtils';
import { generateAndUploadShareImage, ensureStorageBucketExists } from '@/utils/imageUpload';
import { supabase } from '@/integrations/supabase/client';

interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string;
  draftTitle: string;
  teamScores: TeamScore[];
  totalPicks: number;
  onImageGenerated?: (imageUrl: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  draftId,
  draftTitle, 
  teamScores, 
  totalPicks,
  onImageGenerated
}) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const shareCardRef = useRef<HTMLDivElement>(null);

  const textShareData = generateShareText(draftTitle, teamScores, totalPicks);
  const imageShareData = generateImageShareText(draftTitle, teamScores);

  // Initialize storage bucket on mount
  React.useEffect(() => {
    ensureStorageBucketExists();
  }, []);

  const handleShare = async (platform: string, useImage = false) => {
    console.log('Share button clicked:', platform, 'useImage:', useImage);
    const shareData = useImage ? imageShareData : textShareData;
    console.log('Share data:', shareData);
    
    switch (platform) {
      case 'native':
        console.log('Attempting native share...');
        if (navigator.share) {
          try {
            await navigator.share({ 
              title: shareData.title, 
              text: shareData.text, 
              url: shareData.url 
            });
            console.log('Native share successful');
          } catch (error) {
            console.log('Native share cancelled or failed:', error);
          }
        } else {
          console.log('Native share not supported, falling back to copy');
          handleShare('copy', useImage);
        }
        break;
      
      
      case 'facebook':
        console.log('Attempting Facebook share...');
        // Use the special share page URL that has proper meta tags for Facebook
        const facebookShareUrl = generateFacebookShareUrl(draftId);
        console.log('Generated Facebook share URL:', facebookShareUrl);
        
        // Add quote parameter to pre-populate Facebook post with our custom text
        const encodedQuote = encodeURIComponent(shareData.text);
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(facebookShareUrl)}&quote=${encodedQuote}`;
        console.log('Facebook URL:', facebookUrl);
        window.open(facebookUrl, '_blank');
        break;
        
      case 'copy':
        console.log('Attempting to copy link to clipboard...');
        try {
          console.log('Link to copy:', shareData.url);
          await navigator.clipboard.writeText(shareData.url);
          setCopied(true);
          console.log('Successfully copied link to clipboard');
          toast({
            title: "Link copied to clipboard!",
            description: "Share link has been copied to your clipboard.",
          });
          setTimeout(() => setCopied(false), 2000);
        } catch (error) {
          console.error('Copy to clipboard failed:', error);
          toast({
            title: "Copy failed",
            description: "Could not copy to clipboard. Please try again.",
            variant: "destructive",
          });
        }
        break;
      
      
        
      default:
        console.warn('Unknown share platform:', platform);
    }
  };

  const generateAndDownloadImage = async () => {
    setGenerating(true);
    try {
      console.log('Starting image generation process...');
      
      // Generate design using Canva API
      const result = await generateAndUploadShareImage(
        draftTitle,
        teamScores
      );

      console.log('Image generation result:', result);

      if (result) {
        setShareImageUrl(result);
        onImageGenerated?.(result);
        
        toast({
          title: "Canva design created!",
          description: "Opening Canva editor for your movie draft results.",
        });
        
        // Open Canva editor
        window.open(result, '_blank');
      } else {
        throw new Error('Failed to generate Canva design');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateCanvaDesign = async () => {
    setGeneratingStory(true);
    try {
      console.log('Starting Canva design creation...');
      
      const { data, error } = await supabase.functions.invoke('canva-design', {
        body: {
          action: 'create',
          draftTitle,
          teamScores
        }
      });

      console.log('Canva design response:', data);

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Canva Template Ready!",
          description: "Opening Canva template with your movie draft data.",
        });
        
        // Open Canva template
        window.open(data.editUrl, '_blank');
        
        // Show the data to copy
        if (data.designData) {
          const dataText = `Title: ${data.designData.title}\nWinner: ${data.designData.winner} (${data.designData.winnerScore}/10)\n\nLeaderboard:\n${data.designData.leaderboard}\n\nTop Movies: ${data.designData.topMovies}`;
          
          // Copy to clipboard
          await navigator.clipboard.writeText(dataText);
          
          toast({
            title: "Design data copied!",
            description: "Paste this data into your Canva design elements.",
          });
        }
      }
    } catch (error) {
      console.error('Canva design creation failed:', error);
      toast({
        title: "Template ready",
        description: "Opening Canva template. Manually add your draft results.",
        variant: "default",
      });
      // Fallback - just open Canva
      window.open('https://www.canva.com/design/create?type=InstagramStory', '_blank');
    } finally {
      setGeneratingStory(false);
    }
  };

  const ShareButtons = ({ useImage = false }: { useImage?: boolean }) => (
    <div className="flex gap-3 justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('copy', useImage)}
        className="justify-start min-w-[180px]"
      >
        {copied ? (
          <>
            <Check size={16} className="mr-2 text-green-500" />
            Link Copied!
          </>
        ) : (
          <>
            <Copy size={16} className="mr-2" />
            Copy Link to Clipboard
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('facebook', useImage)}
        className="justify-start"
      >
        <Facebook size={16} className="mr-2" />
        Facebook
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={20} />
            Share Your Draft Results
          </DialogTitle>
          <DialogDescription>
            Share your movie draft results on social media or copy the link to share with friends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Copy Link Section */}
          <div className="space-y-3">
            <h3 className="font-semibold">Share Link</h3>
            <ShareButtons useImage={false} />
          </div>

          {/* Visual Share Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Professional Design with Canva</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAndDownloadImage}
                disabled={generating}
              >
                <Download size={16} className="mr-2" />
                {generating ? 'Creating...' : 'Generate & Download'}
              </Button>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-1/2 flex justify-center">
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-border/20 rounded-lg p-8 shadow-lg w-full max-w-sm">
                  <div className="text-center space-y-4">
                    <Sparkles size={48} className="mx-auto text-primary" />
                    <h4 className="font-semibold text-lg">Canva Design Preview</h4>
                    <p className="text-sm text-muted-foreground">
                      Your movie draft results will be transformed into a professional Canva design optimized for social media sharing.
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Winner:</span>
                        <span className="font-medium">{teamScores.sort((a, b) => b.averageScore - a.averageScore)[0]?.playerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Top Score:</span>
                        <span className="font-medium">{teamScores.sort((a, b) => b.averageScore - a.averageScore)[0]?.averageScore.toFixed(1)}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Participants:</span>
                        <span className="font-medium">{teamScores.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="lg:w-1/2 space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateCanvaDesign}
                    disabled={generatingStory}
                    className="flex-1"
                  >
                    <Sparkles size={16} className="mr-2" />
                    {generatingStory ? 'Creating...' : 'Edit in Canva'}
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Share Text</h4>
                  <div className="bg-muted p-3 rounded text-sm whitespace-pre-line max-h-32 overflow-y-auto">
                    {imageShareData.text}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Click "Edit in Canva" to customize your design</p>
                  <p>• Use "Generate & Download" for instant sharing</p>
                  <p>• Professional templates optimized for Instagram Stories</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;