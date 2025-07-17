
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
  let totalScore = 0;
  const availableComponents: string[] = [];
  const missingComponents: string[] = [];

  // Box Office Score - Direct profit percentage (0-100+ points)
  let boxOfficeScore = 0;
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget;
    const profitPercentage = (profit / data.revenue) * 100;
    boxOfficeScore = Math.max(profitPercentage, 0); // Allow unlimited upside
    totalScore += boxOfficeScore;
    availableComponents.push('Box Office');
  } else {
    missingComponents.push('Box Office');
  }

  // RT Critics Score - Direct percentage (0-100 points)
  const rtCriticsScore = data.rtCriticsScore || 0;
  if (data.rtCriticsScore) {
    totalScore += rtCriticsScore;
    availableComponents.push('RT Critics');
  } else {
    missingComponents.push('RT Critics');
  }

  // RT Audience Score removed from scoring
  const rtAudienceScore = 0;

  // Metacritic Score - Direct score (0-100 points)
  const metacriticScore = data.metacriticScore || 0;
  if (data.metacriticScore) {
    totalScore += metacriticScore;
    availableComponents.push('Metacritic');
  } else {
    missingComponents.push('Metacritic');
  }

  // IMDB Score - Convert to percentage (0-100 points)
  let imdbScore = 0;
  if (data.imdbRating) {
    imdbScore = (data.imdbRating / 10) * 100;
    totalScore += imdbScore;
    availableComponents.push('IMDB');
  } else {
    missingComponents.push('IMDB');
  }

  // Oscar Bonus - Direct points (+10 for nomination, +20 for winner)
  let oscarBonus = 0;
  if (data.oscarStatus === 'winner') {
    oscarBonus = 20;
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 10;
  }
  totalScore += oscarBonus;
  availableComponents.push('Oscar Status');

  // Final score is the sum of all components
  const finalScore = totalScore;

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
  if (score >= 300) return 'text-green-500';
  if (score >= 250) return 'text-yellow-500';
  if (score >= 200) return 'text-orange-500';
  return 'text-red-500';
};

export const getScoreGrade = (score: number): string => {
  if (score >= 350) return 'A+';
  if (score >= 300) return 'A';
  if (score >= 250) return 'B';
  if (score >= 200) return 'C';
  if (score >= 150) return 'D';
  return 'F';
};
