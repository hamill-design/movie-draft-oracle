import React, { useState, useRef } from 'react';
import { X, Download, Share2, Facebook, Instagram, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import ShareCard from './ShareCard';
import { generateShareText, generateImageShareText, generateFacebookShareUrl } from '@/utils/shareUtils';
import { generateAndUploadShareImage, ensureStorageBucketExists } from '@/utils/imageUpload';

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
      
      case 'instagram':
        console.log('Attempting Instagram share...');
        // Instagram doesn't have a direct URL share, so we'll copy the text for the user to paste
        try {
          const textToCopy = `${shareData.text}\n\n${shareData.url}`;
          await navigator.clipboard.writeText(textToCopy);
          toast({
            title: "Text copied for Instagram!",
            description: "Paste this in your Instagram post or story.",
          });
        } catch (error) {
          console.error('Copy for Instagram failed:', error);
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
        console.log('Attempting to copy to clipboard...');
        try {
          const textToCopy = `${shareData.text}\n\n${shareData.url}`;
          console.log('Text to copy:', textToCopy);
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
          console.log('Successfully copied to clipboard');
          toast({
            title: "Copied to clipboard!",
            description: "Share text has been copied to your clipboard.",
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

  const ShareButtons = ({ useImage = false }: { useImage?: boolean }) => (
    <div className="grid grid-cols-2 gap-3">
      {navigator.share && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('native', useImage)}
          className="justify-start"
        >
          <Share2 size={16} className="mr-2" />
          Share
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('facebook', useImage)}
        className="justify-start"
      >
        <Facebook size={16} className="mr-2" />
        Facebook
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('instagram', useImage)}
        className="justify-start"
      >
        <Instagram size={16} className="mr-2" />
        Instagram
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('copy', useImage)}
        className="justify-start col-span-2"
      >
        {copied ? (
          <>
            <Check size={16} className="mr-2 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy size={16} className="mr-2" />
            Copy to Clipboard
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