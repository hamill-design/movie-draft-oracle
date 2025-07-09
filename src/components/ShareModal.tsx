import React, { useState, useRef } from 'react';
import { X, Download, Share2, Instagram, Copy, Check, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
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
    if (!shareCardRef.current) return;
    
    setGenerating(true);
    try {
      // Generate and upload image for social sharing
      const uploadedImageUrl = await generateAndUploadShareImage(
        shareCardRef.current,
        draftId,
        draftTitle
      );

      if (uploadedImageUrl) {
        setShareImageUrl(uploadedImageUrl);
        onImageGenerated?.(uploadedImageUrl);
      }

      // Also download locally
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
        width: 400,
        height: 600,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `${draftTitle}-results.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast({
        title: uploadedImageUrl ? "Image generated and uploaded!" : "Image saved!",
        description: uploadedImageUrl 
          ? "Your share image is ready for social media and has been downloaded."
          : "Your share image has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Could not generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateInstagramStory = async () => {
    setGeneratingStory(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-instagram-story', {
        body: {
          draftId,
          draftTitle,
          teamScores
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Instagram Story Generated!",
          description: "Check the image tab to download your Instagram story image.",
        });
        
        // Auto-copy the story text to clipboard
        await navigator.clipboard.writeText(data.storyText);
        
        // Show additional instructions
        toast({
          title: "Story text copied!",
          description: "Paste this text when you post to Instagram.",
        });
      }
    } catch (error) {
      console.error('Instagram story generation failed:', error);
      toast({
        title: "Generation failed",
        description: "Could not generate Instagram story. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingStory(false);
    }
  };

  const ShareButtons = ({ useImage = false }: { useImage?: boolean }) => (
    <div className="flex justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('copy', useImage)}
        className="justify-start min-w-[200px]"
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

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text Share</TabsTrigger>
            <TabsTrigger value="image">Visual Share</TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-3">
              <ShareButtons useImage={false} />
            </div>
          </TabsContent>
          
          <TabsContent value="image" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Visual Share Card</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateAndDownloadImage}
                  disabled={generating}
                >
                  <Download size={16} className="mr-2" />
                  {generating ? 'Generating...' : 'Download'}
                </Button>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="lg:w-1/2">
                  <div ref={shareCardRef}>
                    <ShareCard 
                      draftTitle={draftTitle} 
                      teamScores={teamScores}
                      className="transform scale-90 origin-top"
                    />
                  </div>
                </div>
                
                <div className="lg:w-1/2 space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateInstagramStory}
                      disabled={generatingStory}
                      className="flex-1"
                    >
                      <Instagram size={16} className="mr-2" />
                      {generatingStory ? 'Generating...' : 'Generate for Instagram'}
                    </Button>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Caption Text</h4>
                    <div className="bg-muted p-3 rounded text-sm whitespace-pre-line max-h-32 overflow-y-auto">
                      {imageShareData.text}
                    </div>
                  </div>
                  <ShareButtons useImage={true} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;