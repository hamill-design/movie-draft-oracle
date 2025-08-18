
import html2canvas from 'html2canvas';

interface TeamScore {
  playerName: string;
  totalScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface DraftData {
  title: string;
  teamScores: TeamScore[];
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

const createShareImageHTML = (draftData: DraftData): string => {
  const topTeams = draftData.teamScores.slice(0, 3);
  const winner = topTeams[0];
  
  const colors = {
    background: '#FCFFFF',
    gradientStart: '#FCFFFF',
    gradientMid: '#F0F1FF', 
    gradientEnd: '#FCFFFF',
    primary: '#680AFF',
    text: '#2B2D2D',
    white: '#FFFFFF',
    purple100: '#EDEBFF',
    purple200: '#BCB2FF',
    purple500: '#680AFF',
    purple700: '#3B0394',
    yellow500: '#FFD60A'
  };

  // Embed custom fonts directly in the HTML template
  const fontStyles = `
    <style>
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-regular.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-medium.woff2') format('woff2');
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-semibold.woff2') format('woff2');
        font-weight: 600;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-bold.woff2') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Chaney';
        src: url('/fonts/chaney/chaney-regular.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Chaney Wide';
        src: url('/fonts/chaney/chaney-wide.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Chaney Extended';
        src: url('/fonts/chaney/chaney-extended.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Chaney Ultra Extended';
        src: url('/fonts/chaney/chaney-ultraextended.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
    </style>
  `;
  
  // Create team score items with custom fonts
  const teamScoreItems = topTeams.map((team, index) => `
    <div style="padding: 36px 24px; background: ${colors.white}; border-radius: 8px; border: 1px solid ${colors.purple100}; margin-bottom: 16px; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 32px; height: 32px; background: ${colors.yellow500}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <span style="color: ${colors.text}; font-size: 16px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 600;">${index + 1}</span>
          </div>
          <div>
            <div style="color: ${colors.text}; font-size: 32px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 500; line-height: 1.2;">${team.playerName}</div>
          </div>
        </div>
        <div>
          <div style="color: ${colors.purple500}; font-size: 48px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 600; line-height: 1; text-align: right;">${team.totalScore.toFixed(1)}</div>
        </div>
      </div>
    </div>
  `).join('');

  // Create movie section with custom fonts
  const createMovieSection = (movie: any, title: string) => {
    if (!movie) return '';
    
    return `
      <div style="width: 998px; padding: 36px; border-radius: 4px; margin-bottom: 24px;">
        <div style="text-align: center; margin-bottom: 36px;">
          <h2 style="color: ${colors.text}; font-size: 48px; font-family: 'Chaney Wide', Arial, sans-serif; font-weight: 400; margin: 0; letter-spacing: 1.5px;">${title}</h2>
        </div>
        <div style="padding: 24px; background: ${colors.white}; border-radius: 4px; border: 1px solid ${colors.purple200};">
          <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 200px; height: 298px; flex-shrink: 0;">
              <img style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px; border: 1px solid ${colors.text};" src="${movie.poster || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgdmlld0JveD0iMCAwIDIwMCAyOTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjk4IiBmaWxsPSIjRURFQkZGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQ5IiBmaWxsPSIjNjgwQUZGIiBmb250LXNpemU9IjE2IiBmb250LWZhbWlseT0iQXJpYWwiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'}" alt="${movie.title || 'Movie poster'}" />
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; height: 298px;">
              <div>
                <h3 style="color: ${colors.text}; font-size: 36px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 600; margin: 0 0 8px 0; line-height: 1.2;">${movie.title}</h3>
                <p style="color: ${colors.text}; font-size: 24px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 400; margin: 0 0 24px 0;">${movie.year || 'Unknown'} • ${movie.genre || 'Movie'}</p>
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 24px;">
                  <div style="width: 52px; height: 52px; border: 2px solid ${colors.primary}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <span style="color: ${colors.primary}; font-size: 24px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 600;">${movie.pickNumber || '?'}</span>
                  </div>
                  <div style="padding: 8px 16px; background: ${colors.purple200}; border-radius: 8px;">
                    <span style="color: ${colors.purple700}; font-size: 24px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 500;">${movie.category || 'Category'}</span>
                  </div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="color: ${colors.purple500}; font-size: 48px; font-family: 'Brockmann', Arial, sans-serif; font-weight: 600; line-height: 1;">${movie.score.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  return `
    ${fontStyles}
    <div style="width: 1080px; min-height: 1400px; padding: 112px 24px; background: linear-gradient(140deg, ${colors.gradientStart} 0%, ${colors.gradientMid} 50%, ${colors.gradientEnd} 100%); box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 48px;">
        <div style="color: ${colors.text}; font-size: 64px; font-family: 'Chaney Extended', Arial, sans-serif; font-weight: 400; line-height: 1; margin-bottom: 8px; letter-spacing: 2px;">THE</div>
        <div style="color: ${colors.purple500}; font-size: 64px; font-family: 'Chaney Extended', Arial, sans-serif; font-weight: 400; line-height: 1; margin-bottom: 8px; letter-spacing: 2px;">${winner?.playerName || 'DRAFT'}</div>
        <div style="color: ${colors.text}; font-size: 64px; font-family: 'Chaney Extended', Arial, sans-serif; font-weight: 400; line-height: 1; letter-spacing: 2px;">DRAFT</div>
      </div>
      
      <div style="width: 100%; max-width: 998px; margin: 0 auto 48px auto; padding: 24px; border-radius: 4px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: ${colors.text}; font-size: 48px; font-family: 'Chaney Wide', Arial, sans-serif; font-weight: 400; margin: 0; letter-spacing: 1.5px;">TOP SCORES</h2>
        </div>
        <div>
          ${teamScoreItems}
        </div>
      </div>
      
      ${createMovieSection(draftData.firstPick, 'FIRST PICK')}
      ${createMovieSection(draftData.bestMovie, 'HIGHEST SCORER')}
      
      <div style="width: 728px; margin: 24px auto 0 auto;">
        <div style="height: 8px; background: ${colors.primary}; border-radius: 4px;"></div>
      </div>
    </div>
  `;
};

export const generateShareImage = async (draftData: DraftData): Promise<string> => {
  try {
    console.log('Generating share image with data:', draftData);
    
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '1080px';
    container.style.height = 'auto';
    
    // Load fonts before generating image
    await loadFonts();
    
    // Set the HTML content
    const htmlContent = createShareImageHTML(draftData);
    console.log('Generated HTML content length:', htmlContent.length);
    container.innerHTML = htmlContent;
    
    // Append to body temporarily
    document.body.appendChild(container);
    
    // Wait for images to load
    await waitForImages(container);
    
    console.log('Container dimensions:', container.scrollWidth, 'x', container.scrollHeight);
    
    // Wait a bit more for fonts to fully render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Starting canvas generation...');
    // Generate the image with simplified settings
    const canvas = await html2canvas(container, {
      width: 1080,
      height: container.scrollHeight,
      scale: 1,
      backgroundColor: '#FCFFFF',
      useCORS: false,
      allowTaint: false,
      logging: true, // Enable logging for debugging
      foreignObjectRendering: false,
      imageTimeout: 10000, // Increased timeout
      removeContainer: false,
      onclone: (clonedDoc, element) => {
        // Log cloned content for debugging
        console.log('Cloned document ready, element height:', element.scrollHeight);
        const textElements = element.querySelectorAll('*');
        console.log('Text elements found:', textElements.length);
      }
    });
    
    console.log('Canvas generated successfully:', canvas.width, 'x', canvas.height);
    
    // Remove the temporary container
    document.body.removeChild(container);
    
    // Convert to JPG data URL
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Error generating share image:', error);
    throw error;
  }
};

// Helper function to load custom fonts
const loadFonts = async (): Promise<void> => {
  console.log('Loading custom fonts...');
  try {
    // Load all custom font variants
    const fontPromises = [
      document.fonts.load('400 16px "Brockmann"'),
      document.fonts.load('500 16px "Brockmann"'),
      document.fonts.load('600 16px "Brockmann"'),
      document.fonts.load('700 16px "Brockmann"'),
      document.fonts.load('400 16px "Chaney"'),
      document.fonts.load('400 16px "Chaney Wide"'),
      document.fonts.load('400 16px "Chaney Extended"'),
      document.fonts.load('400 16px "Chaney Ultra Extended"')
    ];

    await Promise.allSettled(fontPromises);
    
    // Wait for document.fonts.ready to ensure all fonts are fully loaded
    await document.fonts.ready;
    
    // Additional wait to ensure fonts are applied
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('All custom fonts loaded successfully');
    console.log('Available fonts:', Array.from(document.fonts).map(f => f.family));
  } catch (error) {
    console.warn('Custom font loading failed, falling back to system fonts:', error);
  }
};

// Helper function to convert image URL to base64
const convertImageToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { 
      mode: 'cors',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to base64:', url, error);
    // Return a placeholder base64 image
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgdmlld0JveD0iMCAwIDIwMCAyOTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjk4IiBmaWxsPSIjRURFQkZGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQ5IiBmaWxsPSIjNjgwQUZGIiBmb250LXNpemU9IjE2IiBmb250LWZhbWlseT0iQXJpYWwiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
  }
};

// Helper function to wait for images to load and convert external ones to base64
const waitForImages = async (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  
  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      try {
        console.log('Converting external image to base64:', src);
        const base64Url = await convertImageToBase64(src);
        img.src = base64Url;
        console.log('Successfully converted image to base64');
      } catch (error) {
        console.warn('Failed to convert image, using fallback:', error);
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgdmlld0JveD0iMCAwIDIwMCAyOTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjk4IiBmaWxsPSIjRURFQkZGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQ5IiBmaWxsPSIjNjgwQUZGIiBmb250LXNpemU9IjE2IiBmb250LWZhbWlseT0iQXJpYWwiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
      }
    }
  }
  
  // Wait for all images to finish loading
  const imagePromises = Array.from(images).map(img => {
    return new Promise<void>((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(() => resolve(), 3000);
      }
    });
  });
  
  await Promise.all(imagePromises);
};

export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
