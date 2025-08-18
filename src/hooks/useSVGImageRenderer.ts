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
    // Create an image element to load the SVG
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    
    img.onerror = (error) => {
      reject(new Error(`Failed to load SVG image: ${error}`));
    };
    
    // Convert SVG string to data URL
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
    
    // Clean up URL after image loads or fails
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG image: ${error}`));
    };
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