
export interface MovieScoringData {
  budget?: number | null;
  revenue?: number | null;
  rtCriticsScore?: number | null;
  rtAudienceScore?: number | null;
  imdbRating?: number | null;
  oscarStatus?: string | null;
}

export interface ScoreBreakdown {
  boxOfficeScore: number;
  rtCriticsScore: number;
  rtAudienceScore: number;
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

  // Box Office Score (30% weight)
  let boxOfficeScore = 0;
  if (data.budget && data.revenue && data.budget > 0) {
    const roi = ((data.revenue - data.budget) / data.budget) * 100;
    boxOfficeScore = Math.min(Math.max(roi, 0), 100);
    totalScore += boxOfficeScore * 0.3;
    totalWeight += 0.3;
    availableComponents.push('Box Office');
  } else {
    missingComponents.push('Box Office');
  }

  // RT Critics Score (50% weight)
  const rtCriticsScore = data.rtCriticsScore || 0;
  if (data.rtCriticsScore) {
    totalScore += rtCriticsScore * 0.5;
    totalWeight += 0.5;
    availableComponents.push('RT Critics');
  } else {
    missingComponents.push('RT Critics');
  }

  // RT Audience Score removed from scoring
  const rtAudienceScore = 0;

  // IMDB Score (10% weight)
  let imdbScore = 0;
  if (data.imdbRating) {
    imdbScore = (data.imdbRating / 10) * 100;
    totalScore += imdbScore * 0.1;
    totalWeight += 0.1;
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
