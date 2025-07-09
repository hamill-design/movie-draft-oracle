import React, { useState, useRef } from 'react';
import { X, Download, Share2, Twitter, Facebook, Linkedin, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import ShareCard from './ShareCard';
import { generateShareText, generateImageShareText } from '@/utils/shareUtils';
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
    const shareData = useImage ? imageShareData : textShareData;
    
    switch (platform) {
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ 
              title: shareData.title, 
              text: shareData.text, 
              url: shareData.url 
            });
          } catch (error) {
            console.log('Share cancelled');
          }
        } else {
          handleShare('copy', useImage);
        }
        break;
      
      case 'twitter':
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
        window.open(twitterUrl, '_blank');
        break;
      
      case 'facebook':
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&quote=${encodeURIComponent(shareData.text)}`;
        window.open(facebookUrl, '_blank');
        break;
      
      case 'linkedin':
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}&summary=${encodeURIComponent(shareData.text)}`;
        window.open(linkedinUrl, '_blank');
        break;
      
      case 'copy':
        try {
          await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
          setCopied(true);
          toast({
            title: "Copied to clipboard!",
            description: "Share text has been copied to your clipboard.",
          });
          setTimeout(() => setCopied(false), 2000);
        } catch (error) {
          toast({
            title: "Copy failed",
            description: "Could not copy to clipboard. Please try again.",
            variant: "destructive",
          });
        }
        break;
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
        onClick={() => handleShare('twitter', useImage)}
        className="justify-start"
      >
        <Twitter size={16} className="mr-2" />
        Twitter
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('linkedin', useImage)}
        className="justify-start"
      >
        <Linkedin size={16} className="mr-2" />
        LinkedIn
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
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text Share</TabsTrigger>
            <TabsTrigger value="image">Visual Share</TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold">Share Text Preview</h3>
              <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-line max-h-40 overflow-y-auto">
                {textShareData.text}
              </div>
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