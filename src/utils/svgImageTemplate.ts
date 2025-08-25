import { generateFontCSS } from './fontUtils';

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

const convertImageToBase64 = async (url: string): Promise<string> => {
  const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+';
  
  try {
    if (!url || url.trim() === '') {
      console.log('Empty URL provided, using placeholder');
      return placeholder;
    }
    
    // If it's already a data URL, return it
    if (url.startsWith('data:')) {
      console.log('URL is already a data URL');
      return url;
    }
    
    console.log('Converting image to base64:', url);
    
    // Create image element to test if it loads
    const testImg = new Image();
    testImg.crossOrigin = 'anonymous';
    
    const imageLoadPromise = new Promise<string>((resolve, reject) => {
      testImg.onload = async () => {
        try {
          // Create canvas to convert image to base64
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          canvas.width = testImg.width;
          canvas.height = testImg.height;
          ctx.drawImage(testImg, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('Successfully converted image to base64');
          resolve(dataUrl);
        } catch (canvasError) {
          console.warn('Canvas conversion failed, trying fetch method:', canvasError);
          // Fallback to fetch method
          try {
            const response = await fetch(url, {
              mode: 'cors',
              headers: { 'Accept': 'image/*' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(blob);
          } catch (fetchError) {
            reject(fetchError);
          }
        }
      };
      
      testImg.onerror = () => reject(new Error('Image failed to load'));
    });
    
    // Set timeout for image loading
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Image load timeout')), 10000);
    });
    
    testImg.src = url;
    
    return await Promise.race([imageLoadPromise, timeoutPromise]);
    
  } catch (error) {
    console.warn('Failed to convert image to base64:', url, error);
    return placeholder;
  }
};

const generateMovieSection = async (movie: any, title: string, yOffset: number) => {
  if (!movie) return '';
  
  const posterBase64 = movie.poster ? await convertImageToBase64(movie.poster) : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+';
  
  const SECTION_PADDING = 24;
  const CARD_PADDING = 24;
  
  return `
    <g transform="translate(${SECTION_PADDING}, ${yOffset})">
      <!-- Section Header -->
      <text x="499" y="64" text-anchor="middle" fill="#2B2D2D" class="brockmann-bold" font-size="48" letter-spacing="1.92px">${title}</text>
      
      <!-- Section Container with Padding -->
      <g transform="translate(0, 100)">
        <!-- Card Background -->
        <rect x="0" y="0" width="950" height="346" fill="white" stroke="#BCB2FF" stroke-width="1" rx="4"/>
        
        <!-- Card Content Group with Padding -->
        <g transform="translate(${CARD_PADDING}, ${CARD_PADDING})">
          <!-- Movie Poster -->
          <image x="0" y="0" width="200" height="298" href="${posterBase64}"/>
          
          <!-- Movie Info Group -->
          <g transform="translate(216, 0)">
            <!-- Movie Title -->
            <text x="0" y="60" fill="#2B2D2D" class="brockmann-semibold" font-size="36">${movie.title}</text>
            
            <!-- Movie Details -->
            <text x="0" y="100" fill="#2B2D2D" class="brockmann" font-size="24">${movie.year ? `${movie.year} • ` : ''}${movie.genre || ''}</text>
            
            <!-- Bottom Row: Pick Number and Category -->
            <g transform="translate(0, 148)">
              <!-- Pick Number Circle -->
              <circle cx="26" cy="26" r="26" fill="none" stroke="#680AFF" stroke-width="1.86"/>
              <text x="26" y="35" text-anchor="middle" fill="#680AFF" class="brockmann" font-size="33">${movie.pickNumber || '1'}</text>
              
              <!-- Category Badge -->
              ${movie.category ? `
                <g transform="translate(64, 0)">
                  <rect x="0" y="8" width="${Math.max(movie.category.length * 10 + 32, 180)}" height="36" fill="#BCB2FF" rx="8"/>
                  <text x="16" y="32" fill="#3B0394" class="brockmann-medium" font-size="24">${movie.category}</text>
                </g>
              ` : ''}
            </g>
            
            <!-- Score -->
            <text x="561" y="274" text-anchor="end" fill="#680AFF" class="brockmann-medium" font-size="48">${movie.score.toFixed(2)}</text>
          </g>
        </g>
      </g>
    </g>
  `;
};

export const generateShareImageSVG = async (data: ShareImageData): Promise<string> => {
  const sortedTeamScores = data.teamScores.sort((a, b) => b.totalScore - a.totalScore);
  
  // Always structure title as "THE [NAME] DRAFT" for consistency
  let titleParts = data.title.split(' ');
  let processedTitle: string;
  let highlightStartIndex = -1;
  let highlightEndIndex = -1;
  
  // If title doesn't start with "THE" and end with "DRAFT", format it properly
  if (titleParts[0].toUpperCase() !== 'THE' || titleParts[titleParts.length - 1].toUpperCase() !== 'DRAFT') {
    // Extract the main name part (remove "THE" and "DRAFT" if present)
    const nameWords = titleParts.filter(word => 
      word.toUpperCase() !== 'THE' && word.toUpperCase() !== 'DRAFT'
    );
    processedTitle = `THE ${nameWords.join(' ')} DRAFT`;
    highlightStartIndex = 1;
    highlightEndIndex = nameWords.length; // Highlight all name words
  } else {
    processedTitle = data.title;
    highlightStartIndex = 1;
    highlightEndIndex = titleParts.length - 2; // Highlight everything except "THE" and "DRAFT"
  }
  
  const titleWords = processedTitle.split(' ');

  // Convert movie posters to base64 if they exist - ensure they're always data URLs
  const [firstPickPoster, bestMoviePoster] = await Promise.all([
    data.firstPick?.poster ? convertImageToBase64(data.firstPick.poster) : Promise.resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+'),
    data.bestMovie?.poster ? convertImageToBase64(data.bestMovie.poster) : Promise.resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ci8+PC9zdmc+')
  ]);
  
  // Load fonts
  const fontCSS = await generateFontCSS();
  
  return `
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient Background -->
    <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCFFFF"/>
      <stop offset="50%" stop-color="#F0F1FF"/>
      <stop offset="100%" stop-color="#FCFFFF"/>
    </linearGradient>
    
    
    <!-- Embedded Fonts -->
    <style>
      <![CDATA[
        ${fontCSS}
        
        .main-container {
          display: flex;
          flex-direction: column;
          padding: 160px 24px 88px 24px;
          gap: 48px;
          font-family: 'Brockmann', Arial, sans-serif;
        }
        
        .title {
          font-family: 'CHANEY', serif;
          font-size: 64px;
          font-weight: 400;
          letter-spacing: 2.56px;
          text-align: center;
          color: #2B2D2D;
          margin: 0;
          line-height: 64px;
        }
        
        .title .highlight {
          color: #680AFF;
        }
        
        .section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .section-title {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 48px;
          font-weight: 700;
          letter-spacing: 1.92px;
          text-align: center;
          color: #2B2D2D;
          margin: 0;
        }
        
        .scores-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .score-card {
          display: flex;
          align-items: center;
          padding: 20px;
          background: white;
          border: 1px solid #EDEBFF;
          border-radius: 8px;
          gap: 16px;
        }
        
        .rank-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #2B2D2D;
          border: 3px solid;
          flex-shrink: 0;
        }
        
        .rank-1 { background: #FFD60A; border-color: #FFF2B2; color: #2B2D2D; }
        .rank-2 { background: #CCCCCC; border-color: #E5E5E5; color: #2B2D2D; }
        .rank-3 { background: #DE7E3E; border-color: #FFAE78; color: #2B2D2D; }
        .rank-4, .rank-5, .rank-6, .rank-7, .rank-8 { border-color: #4D4D4D; }
        
        .player-name {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 32px;
          font-weight: 500;
          color: #2B2D2D;
          flex-grow: 1;
          margin: 0;
        }
        
        .player-score {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 48px;
          font-weight: 500;
          color: #680AFF;
          margin: 0;
        }
        
        .movie-card {
          display: flex;
          padding: 24px;
          background: white;
          border: 1px solid #BCB2FF;
          border-radius: 4px;
          gap: 16px;
          align-items: flex-start;
        }
        
         .movie-poster {
           width: 200px;
           height: 298px;
           object-fit: cover;
           border-radius: 4px;
           flex-shrink: 0;
         }
        
        .movie-info {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          height: 298px;
          justify-content: space-between;
        }
        
        .movie-title {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 36px;
          font-weight: 600;
          color: #2B2D2D;
          margin: 0;
          line-height: 1.2;
        }
        
        .movie-details {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 24px;
          font-weight: 400;
          color: #2B2D2D;
          margin: 0;
        }
        
        .movie-top-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: flex-start;
        }
        
        .movie-pick-category {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .pick-circle {
          width: 52px;
          height: 52px;
          border: 1.86px solid #680AFF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 33px;
          font-weight: 400;
          color: #680AFF;
          flex-shrink: 0;
        }
        
        .category-badge {
          padding: 8px 16px;
          background: #BCB2FF;
          border-radius: 8px;
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 24px;
          font-weight: 500;
          color: #3B0394;
        }
        
        .movie-score {
          font-family: 'Brockmann', Arial, sans-serif;
          font-size: 48px;
          font-weight: 500;
          color: #680AFF;
          margin: 0;
          text-align: right;
        }
      ]]>
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#backgroundGradient)"/>
  
  <!-- Main content using foreignObject -->
  <foreignObject x="0" y="0" width="1080" height="1920">
    <div xmlns="http://www.w3.org/1999/xhtml" class="main-container">
      <!-- Title -->
      <h1 class="title">
        ${titleWords.map((word, index) => 
          index >= highlightStartIndex && index <= highlightEndIndex
            ? `<span class="highlight">${word}</span>` 
            : word
        ).join(' ')}
      </h1>
      
      <!-- TOP SCORES Section -->
      <div class="section">
        <h2 class="section-title">TOP SCORES</h2>
        <div class="scores-container">
          ${sortedTeamScores.slice(0, 3).map((team, index) => `
            <div class="score-card">
              <div class="rank-circle rank-${index + 1}">${index + 1}</div>
              <div class="player-name">${team.playerName}</div>
              <div class="player-score">${team.totalScore.toFixed(1)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      ${data.firstPick ? `
      <!-- FIRST PICK Section -->
      <div class="section">
        <h2 class="section-title">FIRST PICK</h2>
        <div class="movie-card">
          <img class="movie-poster" src="${firstPickPoster}" alt="${data.firstPick.title} poster" />
          <div class="movie-info">
            <div class="movie-top-section">
              <h3 class="movie-title">${data.firstPick.title}</h3>
              <p class="movie-details">${data.firstPick.year ? `${data.firstPick.year} • ` : ''}${data.firstPick.genre || ''}</p>
              <div class="movie-pick-category">
                <div class="pick-circle">${data.firstPick.pickNumber || '1'}</div>
                ${data.firstPick.category ? `<div class="category-badge">${data.firstPick.category}</div>` : ''}
              </div>
            </div>
            <div class="movie-score">${data.firstPick.score.toFixed(2)}</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${data.bestMovie ? `
      <!-- HIGHEST SCORER Section -->
      <div class="section">
        <h2 class="section-title">HIGHEST SCORER</h2>
        <div class="movie-card">
          <img class="movie-poster" src="${bestMoviePoster}" alt="${data.bestMovie.title} poster" />
          <div class="movie-info">
            <div class="movie-top-section">
              <h3 class="movie-title">${data.bestMovie.title}</h3>
              <p class="movie-details">${data.bestMovie.year ? `${data.bestMovie.year} • ` : ''}${data.bestMovie.genre || ''}</p>
              <div class="movie-pick-category">
                <div class="pick-circle">${data.bestMovie.pickNumber || '1'}</div>
                ${data.bestMovie.category ? `<div class="category-badge">${data.bestMovie.category}</div>` : ''}
              </div>
            </div>
            <div class="movie-score">${data.bestMovie.score.toFixed(2)}</div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
  </foreignObject>
  
  <!-- Logo -->
  <g transform="translate(126, 1784)">
    <svg width="828" height="39" viewBox="0 0 428 27" fill="none">
      <path d="M44.5008 0.690016V25.656C44.5008 26.0324 44.1876 26.3461 43.8118 26.3461H37.0787C36.7029 26.3461 36.3898 26.0324 36.3898 25.656V11.6048C36.3898 11.0403 35.7321 10.7266 35.2937 11.0716L22.7984 20.9828C22.5479 21.1709 22.2034 21.1709 21.9529 20.9828L9.17574 10.9775C8.73731 10.6325 8.07966 10.9775 8.07966 11.5107V25.656C8.07966 26.0324 7.76649 26.3461 7.3907 26.3461H0.688963C0.313165 26.3461 0 26.0324 0 25.656V0.690016C0 0.313644 0.313165 0 0.688963 0H7.86044C7.86044 0 8.14229 0.0627287 8.26756 0.125457L22.0155 10.6012C22.266 10.7893 22.6105 10.7893 22.8297 10.6012L36.2645 0.156822C36.2645 0.156822 36.5464 0 36.6716 0H43.8431C44.2189 0 44.5321 0.313644 44.5321 0.690016H44.5008Z" fill="#680AFF"/>
      <path d="M85.5485 26.3461H48.689C48.3132 26.3461 48 26.0324 48 25.656V0.690016C48 0.313644 48.3132 0 48.689 0H85.5485C85.9243 0 86.2375 0.313644 86.2375 0.690016V25.656C86.2375 26.0324 85.9243 26.3461 85.5485 26.3461ZM77.9699 18.3795V7.87245C77.9699 7.49608 77.6567 7.18244 77.2809 7.18244H56.9565C56.5807 7.18244 56.2676 7.49608 56.2676 7.87245V18.3795C56.2676 18.7559 56.5807 19.0695 56.9565 19.0695H77.2809C77.6567 19.0695 77.9699 18.7559 77.9699 18.3795Z" fill="#680AFF"/>
      <path d="M127.302 0.940931L116.247 25.907C116.153 26.1579 115.902 26.3147 115.621 26.3147H100.338V26.1265L89.1894 0.940931C89.0015 0.50183 89.3147 0 89.8158 0H97.1438C97.4257 0 97.6449 0.156822 97.7701 0.407737L105.599 18.6618C105.693 18.9127 105.944 19.0695 106.226 19.0695H110.203C110.485 19.0695 110.704 18.9127 110.829 18.6618L118.627 0.407737C118.721 0.156822 118.971 0 119.253 0H126.675C127.176 0 127.49 0.50183 127.302 0.940931Z" fill="#680AFF"/>
      <path d="M152.01 7.93518V18.3795C152.01 18.7559 152.323 19.0695 152.699 19.0695H165.132C165.508 19.0695 165.821 19.3832 165.821 19.7595V25.656C165.821 26.0324 165.508 26.3461 165.132 26.3461H130.684C130.308 26.3461 129.995 26.0324 129.995 25.656V19.7595C129.995 19.3832 130.308 19.0695 130.684 19.0695H143.085C143.461 19.0695 143.774 18.7559 143.774 18.3795V7.93518C143.774 7.55881 143.461 7.24517 143.085 7.24517H130.684C130.308 7.24517 129.995 6.93152 129.995 6.55515V0.690016C129.995 0.313644 130.308 0 130.684 0H165.132C165.508 0 165.821 0.313644 165.821 0.690016V6.58651C165.821 6.96289 165.508 7.27653 165.132 7.27653H152.699C152.323 7.27653 152.01 7.59017 152.01 7.96655V7.93518Z" fill="#680AFF"/>
      <path d="M177.815 7.15107V9.78568H202.743C203.119 9.78568 203.432 10.0993 203.432 10.4757V15.9645C203.432 16.3408 203.119 16.6545 202.743 16.6545H177.815V19.2263H205.311C205.687 19.2263 206 19.54 206 19.9164V25.7188C206 26.0951 205.687 26.4088 205.311 26.4088H170.237C169.861 26.4088 169.548 26.0951 169.548 25.7188V0.690016C169.548 0.313644 169.861 0 170.237 0H205.311C205.687 0 206 0.313644 206 0.690016V6.49242C206 6.86879 205.687 7.18244 205.311 7.18244H177.815V7.15107Z" fill="#680AFF"/>
      <path d="M266.501 13.2357C266.501 21.3591 260.269 26.4088 252.033 26.4088H222.689C222.313 26.4088 222 26.0951 222 25.7188V0.75273C222 0.376358 222.313 0.0627136 222.689 0.0627136H252.064C260.3 0.0627136 266.532 5.08101 266.532 13.2357H266.501ZM258.108 13.2357C258.108 9.84839 255.54 7.27652 252.064 7.27652H230.894C230.518 7.27652 230.205 7.59016 230.205 7.96653V18.505C230.205 18.8813 230.518 19.195 230.894 19.195H252.033C255.54 19.1322 258.077 16.5917 258.077 13.2357H258.108Z" fill="#680AFF"/>
      <path d="M315.448 0.564546C315.355 0.282267 315.104 0.0627136 314.791 0.0627136H300.824C300.51 0.0627136 300.26 0.282267 300.166 0.564546L293.809 24.6837L290.113 19.0695C289.926 18.7559 289.988 18.3795 290.301 18.1599C292.838 16.3095 294.279 13.4239 294.279 10.2248C294.279 4.61055 289.832 0.0627136 283.13 0.0627136H269.507C269.131 0.0627136 268.818 0.376358 268.818 0.75273V25.7188C268.818 26.0951 269.131 26.4088 269.507 26.4088H276.459C276.835 26.4088 277.148 26.0951 277.148 25.7188V21.0455C277.148 20.6691 277.462 20.3555 277.837 20.3555H281.47C281.721 20.3555 281.94 20.4809 282.065 20.7005L285.228 26.0638C285.353 26.2833 285.572 26.4088 285.823 26.4088H301.231C301.544 26.4088 301.794 26.1892 301.888 25.9069L302.703 22.7391C302.765 22.4255 303.047 22.2373 303.36 22.2373H312.348C312.661 22.2373 312.912 22.4569 313.006 22.7391L313.82 25.9069C313.883 26.2206 314.164 26.4088 314.478 26.4088H321.461C321.9 26.4088 322.244 26.001 322.119 25.5619L315.542 0.595908L315.448 0.564546ZM283.099 13.1103H277.775C277.399 13.1103 277.086 12.7966 277.086 12.4203V7.9979C277.086 7.62152 277.399 7.30788 277.775 7.30788H283.099C284.664 7.30788 285.98 8.59382 285.98 10.1934C285.98 11.793 284.664 13.0789 283.099 13.0789V13.1103ZM310.031 14.8981H305.552C305.114 14.8981 304.801 14.4903 304.895 14.0512L306.617 7.33925H308.935L310.657 14.0512C310.782 14.4903 310.438 14.8981 309.999 14.8981H310.031Z" fill="#680AFF"/>
      <path d="M373.603 0.0627271H325.125C324.749 0.0627271 324.436 0.376372 324.436 0.752744V25.7188C324.436 26.0951 324.749 26.4088 325.125 26.4088H332.046C332.422 26.4088 332.735 26.0951 332.735 25.7188V18.6618C332.735 18.2854 333.048 17.9718 333.424 17.9718H350.961C351.337 17.9718 351.65 17.6581 351.65 17.2818V11.4794C351.65 11.103 351.337 10.7893 350.961 10.7893H332.767V7.27653H356.661C357.037 7.27653 357.35 7.59017 357.35 7.96654V25.6874C357.35 26.0638 357.663 26.3774 358.039 26.3774H364.96C365.336 26.3774 365.649 26.0638 365.649 25.6874V7.96654C365.649 7.59017 365.962 7.27653 366.338 7.27653H373.729C374.104 7.27653 374.417 6.96289 374.417 6.58651V0.690017C374.417 0.313644 374.104 0 373.729 0L373.603 0.0627271Z" fill="#680AFF"/>
      <path d="M385.472 7.2138V9.8484H395.4C395.775 9.8484 396.089 10.162 396.089 10.5384V16.0272C396.089 16.4035 395.775 16.7172 395.4 16.7172H385.472V19.2263H397.936C398.312 19.2263 398.625 19.54 398.625 19.9164V25.7501C398.625 26.1265 398.312 26.4401 397.936 26.4401H377.894C377.518 26.4401 377.205 26.1265 377.205 25.7501V0.784102C377.205 0.40773 377.518 0.0940857 377.894 0.0940857H397.936C398.312 0.0940857 398.625 0.40773 398.625 0.784102V6.58651C398.625 6.96288 398.312 7.27652 397.936 7.27652H385.472V7.2138Z" fill="#680AFF"/>
      <path d="M401.976 0.75273C401.976 0.376358 402.289 0.0627136 402.665 0.0627136H416.288C423.021 0.0627136 427.436 4.61055 427.436 10.2248C427.436 13.4239 425.996 16.3095 423.459 18.1599C423.177 18.3795 423.083 18.7559 423.271 19.0695L427.405 25.3424C427.687 25.7815 427.405 26.4088 426.841 26.4088H418.918C418.668 26.4088 418.448 26.2833 418.323 26.0638L415.16 20.7005C415.035 20.4809 414.816 20.3555 414.565 20.3555H410.933C410.557 20.3555 410.244 20.6691 410.244 21.0455V25.7188C410.244 26.0951 409.93 26.4088 409.555 26.4088H402.602C402.227 26.4088 401.913 26.0951 401.913 25.7188V0.75273H401.976ZM416.288 13.1103C417.853 13.1103 419.169 11.8243 419.169 10.2248C419.169 8.62518 417.853 7.33925 416.288 7.33925H410.964C410.588 7.33925 410.275 7.65289 410.275 8.02926V12.4516C410.275 12.828 410.588 13.1416 410.964 13.1416H416.288V13.1103Z" fill="#680AFF"/>
    </svg>
  </g>
</svg>
  `.trim();
};