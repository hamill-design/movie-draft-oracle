
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
  let totalWeight = 0;
  const availableComponents: string[] = [];
  const missingComponents: string[] = [];

  // Box Office Score (20% weight)
  let boxOfficeScore = 0;
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget;
    const profitPercentage = (profit / data.revenue) * 100;
    boxOfficeScore = Math.min(Math.max(profitPercentage, 0), 100);
    totalScore += boxOfficeScore * 0.2;
    totalWeight += 0.2;
    availableComponents.push('Box Office');
  } else {
    missingComponents.push('Box Office');
  }

  // RT Critics Score (23.33% weight)
  const rtCriticsScore = data.rtCriticsScore || 0;
  if (data.rtCriticsScore) {
    totalScore += rtCriticsScore * 0.2333;
    totalWeight += 0.2333;
    availableComponents.push('RT Critics');
  } else {
    missingComponents.push('RT Critics');
  }

  // RT Audience Score removed from scoring
  const rtAudienceScore = 0;

  // Metacritic Score (23.33% weight)
  const metacriticScore = data.metacriticScore || 0;
  if (data.metacriticScore) {
    totalScore += metacriticScore * 0.2333;
    totalWeight += 0.2333;
    availableComponents.push('Metacritic');
  } else {
    missingComponents.push('Metacritic');
  }

  // IMDB Score (23.33% weight)
  let imdbScore = 0;
  if (data.imdbRating) {
    imdbScore = (data.imdbRating / 10) * 100;
    totalScore += imdbScore * 0.2333;
    totalWeight += 0.2333;
    availableComponents.push('IMDB');
  } else {
    missingComponents.push('IMDB');
  }

  // Oscar Bonus (10% weight)
  let oscarBonus = 0;
  if (data.oscarStatus === 'winner') {
    oscarBonus = 20;
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 10;
  }
  totalScore += oscarBonus * 0.1;
  totalWeight += 0.1;
  availableComponents.push('Oscar Status');

  // Calculate final score
  const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;

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
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
};

export const getScoreGrade = (score: number): string => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};
