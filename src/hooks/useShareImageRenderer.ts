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

const loadFonts = async (): Promise<void> => {
  const fonts = [
    new FontFace('Brockmann', 'url(/fonts/brockmann/brockmann-regular.woff2)', {
      weight: '400',
      style: 'normal',
    }),
    new FontFace('Brockmann', 'url(/fonts/brockmann/brockmann-medium.woff2)', {
      weight: '500',
      style: 'normal',
    }),
    new FontFace('Brockmann', 'url(/fonts/brockmann/brockmann-semibold.woff2)', {
      weight: '600',
      style: 'normal',
    }),
    new FontFace('Brockmann', 'url(/fonts/brockmann/brockmann-bold.woff2)', {
      weight: '700',
      style: 'normal',
    }),
  ];

  try {
    const loadedFonts = await Promise.all(fonts.map(font => font.load()));
    loadedFonts.forEach(font => document.fonts.add(font));
    await document.fonts.ready;
    console.log('All custom fonts loaded successfully');
  } catch (error) {
    console.warn('Error loading fonts:', error);
  }
};

const convertImageToBase64 = async (url: string): Promise<string> => {
  try {
    console.log('Converting external image to base64:', url);
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to base64:', url, error);
    return url; // Fallback to original URL
  }
};

const waitForImages = async (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  const imagePromises = Array.from(images).map(async (img) => {
    if (img.complete && img.naturalHeight > 0) {
      return;
    }
    
    // Convert external images to base64
    if (img.src.startsWith('https://image.tmdb.org')) {
      try {
        const base64 = await convertImageToBase64(img.src);
        img.src = base64;
        console.log('Successfully converted image to base64');
      } catch (error) {
        console.warn('Failed to convert image, using original URL');
      }
    }
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('Image load timeout:', img.src);
        resolve(); // Resolve anyway to not block the process
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn('Image failed to load:', img.src);
        resolve(); // Resolve anyway to not block the process
      };
    });
  });
  
  await Promise.all(imagePromises);
};

export const useShareImageRenderer = () => {
  const renderToCanvas = useCallback(async (data: ShareImageData): Promise<string> => {
    try {
      console.log('Starting component-based image generation');
      
      // Load fonts first
      await loadFonts();
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.background = 'white';
      container.style.fontFamily = 'Brockmann, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      
      // Import React and create the component
      const { default: React } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { default: ShareImageComponent } = await import('@/components/ShareImageComponent');
      
      document.body.appendChild(container);
      
      // Render the component
      const root = createRoot(container);
      
      return new Promise((resolve, reject) => {
        const handleRender = async () => {
          try {
            // Wait for images to load and convert external ones
            await waitForImages(container);
            
            // Additional wait for fonts and layout
            await new Promise(r => setTimeout(r, 1000));
            
            const targetElement = container.firstElementChild as HTMLElement;
            if (!targetElement) {
              throw new Error('No rendered element found');
            }
            
            console.log('Container dimensions:', targetElement.scrollWidth, 'x', targetElement.scrollHeight);
            
            // Generate canvas
            console.log('Starting canvas generation...');
            const canvas = await html2canvas(targetElement, {
              width: 1080,
              height: targetElement.scrollHeight,
              scale: 1,
              backgroundColor: '#FCFFFF',
              useCORS: false,
              allowTaint: false,
              logging: false,
              foreignObjectRendering: false,
              imageTimeout: 15000,
              removeContainer: false
            });
            
            console.log('Canvas generated successfully:', canvas.width, 'x', canvas.height);
            
            // Clean up
            root.unmount();
            document.body.removeChild(container);
            
            // Convert to PNG
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            resolve(dataUrl);
            
          } catch (error) {
            console.error('Error in render process:', error);
            // Clean up on error
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
        
        // Render the component and wait for it to mount
        root.render(React.createElement(ShareImageComponent, { data }));
        
        // Use requestAnimationFrame to ensure the component is rendered
        requestAnimationFrame(() => {
          requestAnimationFrame(handleRender);
        });
      });
      
    } catch (error) {
      console.error('Error in component-based image generation:', error);
      throw error;
    }
  }, []);
  
  return { renderToCanvas };
};