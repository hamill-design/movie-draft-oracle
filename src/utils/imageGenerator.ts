
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
  
  // Create team score items
  const teamScoreItems = topTeams.map((team, index) => `
    <div style="align-self: stretch; padding-left: 24px; padding-right: 24px; padding-top: 36px; padding-bottom: 36px; background: var(--UI-Primary, white); border-radius: 8px; outline: 1px var(--Purple-100, #EDEBFF) solid; outline-offset: -1px; justify-content: space-between; align-items: center; display: inline-flex">
      <div style="flex: 1 1 0; justify-content: flex-start; align-items: center; gap: 16px; display: flex">
        <div style="width: 32px; height: 32px; background: var(--Yellow-500, #FFD60A); border-radius: 9999px; justify-content: center; align-items: center; display: flex">
          <div style="text-align: center; justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 16px; font-family: Brockmann; font-weight: 700; line-height: 24px; word-wrap: break-word">${index + 1}</div>
        </div>
        <div style="flex: 1 1 0; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 2px; display: inline-flex">
          <div style="align-self: stretch; justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 32px; font-family: Brockmann; font-weight: 500; line-height: 24px; word-wrap: break-word">${team.playerName}</div>
        </div>
      </div>
      <div style="flex-direction: column; justify-content: flex-start; align-items: flex-start; display: inline-flex">
        <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-end; display: flex">
          <div style="text-align: right; justify-content: center; display: flex; flex-direction: column; color: var(--Purple-500, #680AFF); font-size: 48px; font-family: Brockmann; font-weight: 500; line-height: 32px; word-wrap: break-word">${team.totalScore.toFixed(1)}</div>
        </div>
      </div>
    </div>
  `).join('');

  // Create movie section if we have first pick or best movie data
  const createMovieSection = (movie: any, title: string) => {
    if (!movie) return '';
    
    return `
      <div style="width: 998px; padding: 36px; border-radius: 4px; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 36px; display: flex">
        <div style="align-self: stretch; flex-direction: column; justify-content: center; align-items: center; gap: 8px; display: flex">
          <div style="justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 48px; font-family: Brockmann; font-weight: 700; line-height: 36px; letter-spacing: 1.92px; word-wrap: break-word">${title}</div>
        </div>
        <div style="align-self: stretch; padding: 24px; background: var(--UI-Primary, white); border-radius: 4px; outline: 1px var(--Purple-200, #BCB2FF) solid; outline-offset: -1px; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 24px; display: flex">
          <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-start; display: flex">
            <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-start; display: flex">
              <div style="align-self: stretch; justify-content: flex-start; align-items: flex-start; gap: 16px; display: inline-flex">
                <div style="width: 200px; height: 298px; flex-direction: column; justify-content: flex-start; align-items: flex-start; display: inline-flex">
                  <img style="align-self: stretch; flex: 1 1 0; position: relative; border-radius: 2px; border: 0.50px var(--Greyscale-(Blue)-800, #2B2D2D) solid" src="${movie.poster || 'https://placehold.co/200x298'}" />
                </div>
                <div style="flex: 1 1 0; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 24px; display: inline-flex">
                  <div style="flex-direction: column; justify-content: center; align-items: flex-start; gap: 24px; display: flex">
                    <div style="flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 4px; display: flex">
                      <div style="justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 36px; font-family: Brockmann; font-weight: 600; line-height: 48px; word-wrap: break-word">${movie.title}</div>
                      <div style="width: 561px; justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 24px; font-family: Brockmann; font-weight: 400; line-height: 40px; word-wrap: break-word">${movie.year || 'Unknown'} • ${movie.genre || 'Movie'}</div>
                    </div>
                    <div style="justify-content: flex-start; align-items: flex-start; gap: 12px; display: inline-flex">
                      <div style="width: 52px; height: 52px; padding-top: 9.29px; padding-bottom: 9.29px; padding-left: 13.93px; padding-right: 16.71px; border-radius: 185712.42px; outline: 1.86px var(--Brand-Primary, #680AFF) solid; outline-offset: -1.86px; flex-direction: column; justify-content: center; align-items: center; display: inline-flex">
                        <div style="text-align: center; color: var(--Brand-Primary, #680AFF); font-size: 33.43px; font-family: Brockmann; font-weight: 400; line-height: 33.43px; word-wrap: break-word">${movie.pickNumber || '?'}</div>
                      </div>
                      <div style="padding-left: 16px; padding-right: 16px; padding-top: 8px; padding-bottom: 8px; background: var(--Purple-200, #BCB2FF); border-radius: 8px; flex-direction: column; justify-content: flex-start; align-items: flex-start; display: inline-flex">
                        <div style="justify-content: center; display: flex; flex-direction: column; color: var(--Purple-700, #3B0394); font-size: 24px; font-family: Brockmann; font-weight: 500; line-height: 36px; word-wrap: break-word">${movie.category || 'Category'}</div>
                      </div>
                    </div>
                  </div>
                  <div style="flex-direction: column; justify-content: flex-start; align-items: flex-start; display: flex">
                    <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-end; display: flex">
                      <div style="text-align: right; justify-content: center; display: flex; flex-direction: column; color: var(--Purple-500, #680AFF); font-size: 48px; font-family: Brockmann; font-weight: 500; line-height: 56px; word-wrap: break-word">${movie.score.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  return `
    <div style="width: 100%; height: 100%; padding-left: 24px; padding-right: 24px; padding-top: 112px; padding-bottom: 112px; background: linear-gradient(140deg, #FCFFFF 0%, #F0F1FF 50%, #FCFFFF 100%); overflow: hidden; flex-direction: column; justify-content: center; align-items: center; gap: 48px; display: inline-flex">
      <div style="text-align: center; justify-content: center; display: flex; flex-direction: column">
        <span style="color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 64px; font-family: CHANEY; font-weight: 400; line-height: 64px; letter-spacing: 2.56px; word-wrap: break-word">THE</span>
        <span style="color: var(--Purple-500, #680AFF); font-size: 64px; font-family: CHANEY; font-weight: 400; line-height: 64px; letter-spacing: 2.56px; word-wrap: break-word"> ${winner?.playerName || 'DRAFT'} </span>
        <span style="color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 64px; font-family: CHANEY; font-weight: 400; line-height: 64px; letter-spacing: 2.56px; word-wrap: break-word">DRAFT</span>
      </div>
      <div style="width: 998px; padding: 24px; border-radius: 4px; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 24px; display: flex">
        <div style="align-self: stretch; flex-direction: column; justify-content: center; align-items: center; gap: 8px; display: flex">
          <div style="justify-content: center; display: flex; flex-direction: column; color: var(--Greyscale-(Blue)-800, #2B2D2D); font-size: 48px; font-family: Brockmann; font-weight: 700; line-height: 36px; letter-spacing: 1.92px; word-wrap: break-word">TOP SCORES</div>
        </div>
        <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 16px; display: flex">
          ${teamScoreItems}
        </div>
      </div>
      ${createMovieSection(draftData.firstPick, 'FIRST PICK')}
      ${createMovieSection(draftData.bestMovie, 'HIGHEST SCORER')}
      <div data-:hover="false" data-property-1="Long" style="width: 728px; justify-content: flex-start; align-items: flex-start; gap: 10px; display: inline-flex">
        <div style="flex: 1 1 0; height: 45.02px; background: var(--Brand-Primary, #680AFF)"></div>
      </div>
    </div>
  `;
};

export const generateShareImage = async (draftData: DraftData): Promise<string> => {
  try {
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
    container.innerHTML = createShareImageHTML(draftData);
    
    // Append to body temporarily
    document.body.appendChild(container);
    
    // Wait for images to load
    await waitForImages(container);
    
    // Generate the image
    const canvas = await html2canvas(container, {
      width: 1080,
      height: container.scrollHeight,
      scale: 2,
      backgroundColor: '#FCFFFF',
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: true
    });
    
    // Remove the temporary container
    document.body.removeChild(container);
    
    // Convert to data URL
    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error('Error generating share image:', error);
    throw error;
  }
};

// Helper function to load fonts
const loadFonts = async (): Promise<void> => {
  const fontPromises = [
    document.fonts.load('400 16px CHANEY'),
    document.fonts.load('700 16px Brockmann'),
    document.fonts.load('500 16px Brockmann'),
    document.fonts.load('600 16px Brockmann')
  ];
  
  try {
    await Promise.all(fontPromises);
    await document.fonts.ready;
  } catch (error) {
    console.warn('Font loading failed, continuing with fallback fonts:', error);
  }
};

// Helper function to wait for images to load
const waitForImages = (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  const imagePromises = Array.from(images).map(img => {
    return new Promise<void>((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Continue even if image fails to load
        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000);
      }
    });
  });
  
  return Promise.all(imagePromises).then(() => {});
};

export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
