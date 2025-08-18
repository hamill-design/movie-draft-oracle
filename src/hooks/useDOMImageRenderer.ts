import { useCallback } from 'react';
import html2canvas from 'html2canvas';

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

// Pre-load custom fonts
const loadFonts = async (): Promise<void> => {
  const fontPromises = [
    document.fonts.load('400 16px Brockmann'),
    document.fonts.load('500 16px Brockmann'),
    document.fonts.load('600 16px Brockmann'),
    document.fonts.load('700 16px Brockmann'),
    document.fonts.load('400 16px Chaney'),
    document.fonts.load('500 16px Chaney'),
    document.fonts.load('600 16px Chaney'),
    document.fonts.load('700 16px Chaney')
  ];
  
  try {
    await Promise.all(fontPromises);
    await document.fonts.ready;
    console.log('All fonts loaded successfully');
  } catch (error) {
    console.warn('Font loading failed:', error);
  }
};

// Convert external images to base64 for better canvas rendering
const convertImageToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to base64:', url);
    return url;
  }
};

// Wait for all images to load
const waitForImages = async (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  const imagePromises = Array.from(images).map(async (img) => {
    if (img.complete && img.naturalHeight > 0) {
      return;
    }
    
    // Convert TMDB images to base64 for better canvas compatibility
    if (img.src.includes('image.tmdb.org')) {
      try {
        const base64 = await convertImageToBase64(img.src);
        img.src = base64;
      } catch (error) {
        console.warn('Failed to convert image:', error);
      }
    }
    
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Image load timeout:', img.src);
        resolve();
      }, 8000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn('Image failed to load:', img.src);
        resolve();
      };
    });
  });
  
  await Promise.all(imagePromises);
};

export const useDOMImageRenderer = () => {
  const renderToCanvas = useCallback(async (data: ShareImageData): Promise<string> => {
    try {
      console.log('Starting DOM-based image generation');
      
      // Step 1: Pre-load fonts
      await loadFonts();
      
      // Step 2: Create hidden container with fixed dimensions
      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        top: -10000px;
        left: 0;
        width: 1080px;
        height: 1920px;
        background: white;
        font-family: 'Brockmann', 'Chaney', -apple-system, BlinkMacSystemFont, sans-serif;
        overflow: hidden;
      `;
      
      document.body.appendChild(container);
      
      // Step 3: Import React and render component
      const { default: React } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { default: ShareImageComponent } = await import('@/components/ShareImageComponent');
      
      const root = createRoot(container);
      
      return new Promise((resolve, reject) => {
        const handleRender = async () => {
          try {
            // Step 4: Wait for images and additional render time
            await waitForImages(container);
            await new Promise(r => setTimeout(r, 1500)); // Allow layout to settle
            
            const targetElement = container.firstElementChild as HTMLElement;
            if (!targetElement) {
              throw new Error('No rendered element found');
            }
            
            console.log('Capturing element with dimensions:', targetElement.scrollWidth, 'x', targetElement.scrollHeight);
            
            // Step 5: Capture with optimized html2canvas settings
            const canvas = await html2canvas(targetElement, {
              width: 1080,
              height: 1920,
              scale: 2, // High DPI for crisp text
              backgroundColor: '#FCFFFF',
              useCORS: true,
              allowTaint: false,
              logging: false,
              foreignObjectRendering: false,
              imageTimeout: 10000,
              removeContainer: false
            });
            
            console.log('Canvas generated:', canvas.width, 'x', canvas.height);
            
            // Step 6: Clean up
            root.unmount();
            document.body.removeChild(container);
            
            // Step 7: Return as PNG
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            resolve(dataUrl);
            
          } catch (error) {
            console.error('DOM rendering error:', error);
            // Cleanup on error
            try {
              root.unmount();
              if (container.parentNode) {
                document.body.removeChild(container);
              }
            } catch (cleanupError) {
              console.warn('Cleanup error:', cleanupError);
            }
            reject(error);
          }
        };
        
        // Render component and wait for mount
        root.render(React.createElement(ShareImageComponent, { data }));
        
        // Use multiple animation frames to ensure full render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(handleRender);
          });
        });
      });
      
    } catch (error) {
      console.error('DOM image generation failed:', error);
      throw error;
    }
  }, []);
  
  return { renderToCanvas };
};