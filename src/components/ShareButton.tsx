import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Linkedin, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ title, text, url }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async (platform: string) => {
    switch (platform) {
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ title, text, url });
          } catch (error) {
            console.log('Share cancelled');
          }
        } else {
          handleShare('copy');
        }
        break;
      
      case 'twitter':
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank');
        break;
      
      case 'facebook':
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
        window.open(facebookUrl, '_blank');
        break;
      
      case 'linkedin':
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`;
        window.open(linkedinUrl, '_blank');
        break;
      
      case 'copy':
        try {
          await navigator.clipboard.writeText(`${text}\n\n${url}`);
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <Share2 size={16} className="mr-2" />
          Share Results
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-gray-800 border-gray-600">
        {navigator.share && (
          <DropdownMenuItem 
            onClick={() => handleShare('native')}
            className="text-gray-300 hover:bg-gray-700 cursor-pointer"
          >
            <Share2 size={16} className="mr-2" />
            Share...
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={() => handleShare('twitter')}
          className="text-gray-300 hover:bg-gray-700 cursor-pointer"
        >
          <Twitter size={16} className="mr-2" />
          Twitter
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleShare('facebook')}
          className="text-gray-300 hover:bg-gray-700 cursor-pointer"
        >
          <Facebook size={16} className="mr-2" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleShare('linkedin')}
          className="text-gray-300 hover:bg-gray-700 cursor-pointer"
        >
          <Linkedin size={16} className="mr-2" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleShare('copy')}
          className="text-gray-300 hover:bg-gray-700 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={16} className="mr-2 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} className="mr-2" />
              Copy Link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareButton;