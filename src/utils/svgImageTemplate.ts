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
    console.warn('Failed to convert image to base64:', url, error);
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+'; // Gray placeholder
  }
};

const generateMovieSection = async (movie: any, title: string, yOffset: number) => {
  if (!movie) return '';
  
  const posterBase64 = movie.poster ? await convertImageToBase64(movie.poster) : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+';
  
  return `
    <g transform="translate(0, ${yOffset})">
      <!-- Section Header -->
      <text x="540" y="60" text-anchor="middle" fill="#2B2D2D" font-family="Brockmann" font-weight="700" font-size="48" letter-spacing="1.92px">${title}</text>
      
      <!-- Card Background -->
      <rect x="41" y="96" width="998" height="370" fill="white" stroke="#BCB2FF" stroke-width="1" rx="4"/>
      
      <!-- Movie Poster -->
      <image x="65" y="120" width="200" height="298" href="${posterBase64}"/>
      
      <!-- Movie Title -->
      <text x="281" y="168" fill="#2B2D2D" font-family="Brockmann" font-weight="600" font-size="36">${movie.title}</text>
      
      <!-- Movie Details -->
      <text x="281" y="208" fill="#2B2D2D" font-family="Brockmann" font-weight="400" font-size="24">${movie.year ? `${movie.year} • ` : ''}${movie.genre || ''}</text>
      
      <!-- Pick Number Circle -->
      <circle cx="307" cy="260" r="26" fill="none" stroke="#680AFF" stroke-width="1.86"/>
      <text x="307" y="272" text-anchor="middle" fill="#680AFF" font-family="Brockmann" font-weight="400" font-size="33">${movie.pickNumber || '1'}</text>
      
      <!-- Category Badge -->
      ${movie.category ? `
        <rect x="369" y="236" width="${movie.category.length * 14 + 32}" height="52" fill="#BCB2FF" rx="8"/>
        <text x="385" y="268" fill="#3B0394" font-family="Brockmann" font-weight="500" font-size="24">${movie.category}</text>
      ` : ''}
      
      <!-- Score -->
      <text x="1015" y="400" text-anchor="end" fill="#680AFF" font-family="Brockmann" font-weight="500" font-size="48">${movie.score.toFixed(2)}</text>
    </g>
  `;
};

export const generateShareImageSVG = async (data: ShareImageData): Promise<string> => {
  const sortedTeamScores = data.teamScores.sort((a, b) => b.totalScore - a.totalScore);
  
  // Split title for purple highlighting
  const titleWords = data.title.split(' ');
  
  // Calculate positions and heights
  let currentY = 600; // Start after scores section
  const firstPickSection = data.firstPick ? await generateMovieSection(data.firstPick, 'FIRST PICK', currentY) : '';
  if (data.firstPick) currentY += 500;
  
  const bestMovieSection = data.bestMovie ? await generateMovieSection(data.bestMovie, 'HIGHEST SCORER', currentY) : '';
  if (data.bestMovie) currentY += 500;
  
  // Calculate total height
  const totalHeight = currentY + 50;
  
  return `
<svg width="1080" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient Background -->
    <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCFFFF"/>
      <stop offset="50%" stop-color="#F0F1FF"/>
      <stop offset="100%" stop-color="#FCFFFF"/>
    </linearGradient>
    
    <!-- Fonts -->
    <style>
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-regular.woff2') format('woff2');
        font-weight: 400;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-medium.woff2') format('woff2');
        font-weight: 500;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-semibold.woff2') format('woff2');
        font-weight: 600;
      }
      @font-face {
        font-family: 'Brockmann';
        src: url('/fonts/brockmann/brockmann-bold.woff2') format('woff2');
        font-weight: 700;
      }
      @font-face {
        font-family: 'Chaney';
        src: url('/fonts/chaney/chaney-regular.woff2') format('woff2');
        font-weight: 400;
      }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#backgroundGradient)"/>
  
  <!-- Title -->
  <text x="540" y="176" text-anchor="middle" font-family="Chaney" font-weight="400" font-size="64" letter-spacing="2.56px">
    ${titleWords.map((word, index) => `<tspan fill="${index === 1 ? '#680AFF' : '#2B2D2D'}">${word}${index < titleWords.length - 1 ? ' ' : ''}</tspan>`).join('')}
  </text>
  
  <!-- TOP SCORES Section -->
  <g>
    <!-- Section Header -->
    <text x="540" y="300" text-anchor="middle" fill="#2B2D2D" font-family="Brockmann" font-weight="700" font-size="48" letter-spacing="1.92px">TOP SCORES</text>
    
    <!-- Score Cards -->
    ${sortedTeamScores.slice(0, 3).map((team, index) => `
      <g>
        <!-- Card Background -->
        <rect x="41" y="${336 + index * 88}" width="998" height="72" fill="white" stroke="#EDEBFF" stroke-width="1" rx="8"/>
        
        <!-- Rank Circle -->
        <circle cx="81" r="16" cy="${372 + index * 88}" fill="#FFD60A"/>
        <text x="81" y="${380 + index * 88}" text-anchor="middle" fill="#2B2D2D" font-family="Brockmann" font-weight="700" font-size="16">${index + 1}</text>
        
        <!-- Player Name -->
        <text x="113" y="${388 + index * 88}" fill="#2B2D2D" font-family="Brockmann" font-weight="500" font-size="32">${team.playerName}</text>
        
        <!-- Score -->
        <text x="1015" y="${388 + index * 88}" text-anchor="end" fill="#680AFF" font-family="Brockmann" font-weight="500" font-size="48">${team.totalScore.toFixed(1)}</text>
      </g>
    `).join('')}
  </g>
  
  <!-- Movie Sections -->
  ${firstPickSection}
  ${bestMovieSection}
  
  <!-- Footer Bar -->
  <rect x="0" y="${totalHeight - 8}" width="1080" height="8" fill="#680AFF"/>
</svg>
  `.trim();
};