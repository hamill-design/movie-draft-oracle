
export interface MovieScoringData {
  budget?: number | null;
  revenue?: number | null;
  rtCriticsScore?: number | null;
  rtAudienceScore?: number | null;
  metacriticScore?: number | null;
  imdbRating?: number | null;
  oscarStatus?: string | null;
}

export interface ScoreBreakdown {
  boxOfficeScore: number;
  rtCriticsScore: number;
  rtAudienceScore: number;
  metacriticScore: number;
  imdbScore: number;
  oscarBonus: number;
  finalScore: number;
  availableComponents: string[];
  missingComponents: string[];
}

export const calculateDetailedScore = (data: MovieScoringData): ScoreBreakdown => {
  const availableComponents: string[] = [];
  const missingComponents: string[] = [];
  const componentScores: number[] = [];

  // Box Office Score - Profit percentage (0-100+ scale)
  let boxOfficeScore = 0;
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget;
    const profitPercentage = (profit / data.revenue) * 100;
    boxOfficeScore = Math.max(profitPercentage, 0); // Allow unlimited upside, cap at reasonable max
    boxOfficeScore = Math.min(boxOfficeScore, 100); // Cap at 100 for averaging purposes
    componentScores.push(boxOfficeScore);
    availableComponents.push('Box Office');
  } else {
    missingComponents.push('Box Office');
  }

  // RT Critics Score - Direct percentage (0-100 scale)
  const rtCriticsScore = data.rtCriticsScore || 0;
  if (data.rtCriticsScore) {
    componentScores.push(rtCriticsScore);
    availableComponents.push('RT Critics');
  } else {
    missingComponents.push('RT Critics');
  }

  // RT Audience Score removed from scoring
  const rtAudienceScore = 0;

  // Metacritic Score - Direct score (0-100 scale)
  const metacriticScore = data.metacriticScore || 0;
  if (data.metacriticScore) {
    componentScores.push(metacriticScore);
    availableComponents.push('Metacritic');
  } else {
    missingComponents.push('Metacritic');
  }

  // IMDB Score - Convert to 0-100 scale
  let imdbScore = 0;
  if (data.imdbRating) {
    imdbScore = (data.imdbRating / 10) * 100;
    componentScores.push(imdbScore);
    availableComponents.push('IMDB');
  } else {
    missingComponents.push('IMDB');
  }

  // Calculate average of available components
  const averageScore = componentScores.length > 0 
    ? componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length
    : 0;

  // Oscar Bonus - Added after averaging (+5 for nomination, +10 for winner)
  let oscarBonus = 0;
  if (data.oscarStatus === 'winner') {
    oscarBonus = 10;
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 5;
  }
  availableComponents.push('Oscar Status');

  // Final score is the average plus Oscar bonus
  const finalScore = averageScore + oscarBonus;

  return {
    boxOfficeScore: Math.round(boxOfficeScore * 100) / 100,
    rtCriticsScore,
    rtAudienceScore,
    metacriticScore,
    imdbScore: Math.round(imdbScore * 100) / 100,
    oscarBonus,
    finalScore: Math.round(finalScore * 100) / 100,
    availableComponents,
    missingComponents
  };
};

export const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-500';
  if (score >= 75) return 'text-yellow-500';
  if (score >= 60) return 'text-orange-500';
  return 'text-red-500';
};

export const getScoreGrade = (score: number): string => {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};
