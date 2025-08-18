import { useCallback } from 'react';
import { generateShareImageSVG } from '@/utils/svgImageTemplate';

interface ShareImageData {
  title: string;
  teamScores: Array<{
    playerName: string;
    totalScore: number;
    completedPicks: number;
    totalPicks: number;
  }>;
  totalMovies: number;
  bestMovie?: {
    title: string;
    score: number;
    playerName: string;
    poster?: string;
    year?: number;
    genre?: string;
    category?: string;
    pickNumber?: number;
  };
  firstPick?: {
    title: string;
    score: number;
    playerName: string;
    poster?: string;
    year?: number;
    genre?: string;
    category?: string;
    pickNumber?: number;
  };
}

const svgToCanvas = async (svgString: string): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Set CORS to anonymous to prevent tainting
    img.crossOrigin = 'anonymous';
    
    const handleLoad = () => {
      try {
        // Set canvas size to match image (default 1080x1920 if dimensions are 0)
        canvas.width = img.width || 1080;
        canvas.height = img.height || 1920;
        
        // Clear canvas and draw the image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        console.log('Canvas rendered successfully:', canvas.width, 'x', canvas.height);
        resolve(canvas);
      } catch (error) {
        console.error('Error drawing image to canvas:', error);
        reject(new Error(`Failed to draw image to canvas: ${error}`));
      }
    };
    
    const handleError = (error: any) => {
      console.error('Image load error:', error);
      reject(new Error(`Failed to load SVG image: ${error}`));
    };
    
    // Set event handlers before setting src
    img.onload = handleLoad;
    img.onerror = handleError;
    
    try {
      // Convert SVG string to data URL directly (no blob URL to avoid CORS issues)
      const encodedSvg = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${encodedSvg}`;
      
      console.log('Loading SVG as data URL...');
      img.src = dataUrl;
    } catch (error) {
      console.error('Error creating SVG data URL:', error);
      reject(new Error(`Failed to create SVG data URL: ${error}`));
    }
  });
};

export const useSVGImageRenderer = () => {
  const renderToCanvas = useCallback(async (data: ShareImageData): Promise<string> => {
    try {
      console.log('Starting SVG-based image generation');
      
      // Generate the SVG string with the data
      const svgString = await generateShareImageSVG(data);
      console.log('SVG generated, converting to canvas...');
      
      // Convert SVG to canvas
      const canvas = await svgToCanvas(svgString);
      console.log('Canvas generated successfully:', canvas.width, 'x', canvas.height);
      
      // Convert canvas to PNG data URL
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      console.log('Image generation complete');
      
      return dataUrl;
      
    } catch (error) {
      console.error('Error in SVG-based image generation:', error);
      throw error;
    }
  }, []);
  
  return { renderToCanvas };
};