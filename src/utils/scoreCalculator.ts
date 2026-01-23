
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
  criticsScore: number;
  audienceScore: number;
  criticalScore: number;
  consensusModifier: number;
  boxOfficeAudienceModifier: number;
  adjustedBoxOfficeWeight: number;
  adjustedCriticalWeight: number;
  oscarBonus: number;
  finalScore: number;
  availableComponents: string[];
  missingComponents: string[];
}

export const calculateDetailedScore = (data: MovieScoringData): ScoreBreakdown => {
  const availableComponents: string[] = [];
  const missingComponents: string[] = [];
  const componentScores: number[] = [];

  // Box Office Score - Hybrid ROI-based formula
  // Linear scaling for 0-100% ROI (0-60 points), logarithmic for >100% ROI (60-100 points)
  let boxOfficeScore = 0;
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget;
    if (profit <= 0) {
      boxOfficeScore = 0; // Flops get 0
    } else {
      const roiPercent = (profit / data.budget) * 100;
      if (roiPercent <= 100) {
        // Linear scaling: 0-100% ROI → 0-60 points (2x return = 60 points)
        boxOfficeScore = 60 * (roiPercent / 100);
      } else {
        // Logarithmic scaling: >100% ROI → 60-100 points (diminishing returns)
        boxOfficeScore = 60 + 40 * (1 - Math.exp(-(roiPercent - 100) / 200));
      }
    }
    availableComponents.push('Box Office');
  } else {
    missingComponents.push('Box Office');
  }

  // RT Critics Score - Direct percentage (0-100 scale)
  const rtCriticsScore = data.rtCriticsScore || 0;
  if (data.rtCriticsScore) {
    availableComponents.push('RT Critics');
  } else {
    missingComponents.push('RT Critics');
  }

  // RT Audience Score removed from scoring
  const rtAudienceScore = 0;

  // Metacritic Score - Direct score (0-100 scale)
  const metacriticScore = data.metacriticScore || 0;
  if (data.metacriticScore) {
    availableComponents.push('Metacritic');
  } else {
    missingComponents.push('Metacritic');
  }

  // IMDB Score - Convert to 0-100 scale
  let imdbScore = 0;
  if (data.imdbRating) {
    imdbScore = (data.imdbRating / 10) * 100;
    availableComponents.push('IMDB');
  } else {
    missingComponents.push('IMDB');
  }

  // Layer 1: Calculate Critics Score (Internal Consensus)
  let criticsRawAvg = 0;
  let criticsScore = 0;
  let criticsInternalModifier = 1;
  
  if (rtCriticsScore && metacriticScore) {
    criticsRawAvg = (rtCriticsScore + metacriticScore) / 2;
    const criticsInternalDiff = Math.abs(rtCriticsScore - metacriticScore);
    criticsInternalModifier = Math.max(0, 1 - (criticsInternalDiff / 200));
    criticsScore = criticsRawAvg * criticsInternalModifier;
  } else if (rtCriticsScore) {
    criticsRawAvg = rtCriticsScore;
    criticsScore = rtCriticsScore;
  } else if (metacriticScore) {
    criticsRawAvg = metacriticScore;
    criticsScore = metacriticScore;
  }

  // Layer 2: Calculate Audience Score (IMDB only, no Letterboxd)
  let audienceRawAvg = 0;
  let audienceScore = 0;
  let audienceInternalModifier = 1;
  
  if (imdbScore) {
    audienceRawAvg = imdbScore;
    audienceScore = imdbScore;
  }

  // Layer 3: Calculate Final Critical Score (Cross-Category Consensus)
  let criticalScore = 0;
  let consensusModifier = 1;
  
  if (criticsRawAvg > 0 && audienceRawAvg > 0) {
    // Use RAW averages for consensus calculation
    const criticsAudienceDiff = Math.abs(criticsRawAvg - audienceRawAvg);
    consensusModifier = Math.max(0, 1 - (criticsAudienceDiff / 200));
    
    // Weighted average of penalized scores (50/50)
    const weightedAvg = (criticsScore * 0.5) + (audienceScore * 0.5);
    criticalScore = weightedAvg * consensusModifier;
  } else if (criticsScore > 0) {
    criticalScore = criticsScore;
  } else if (audienceScore > 0) {
    criticalScore = audienceScore;
  }

  // Fixed weights: 20% Box Office, 80% Critical Score
  let boxOfficeWeight = 0.20;
  let criticalWeight = 0.80;
  
  if (boxOfficeScore > 0 && criticalScore > 0) {
    // Both available: use fixed 20/80 split
    boxOfficeWeight = 0.20;
    criticalWeight = 0.80;
  } else if (boxOfficeScore > 0) {
    // Only Box Office available
    boxOfficeWeight = 1.0;
    criticalWeight = 0;
  } else if (criticalScore > 0) {
    // Only Critical Score available
    boxOfficeWeight = 0;
    criticalWeight = 1.0;
  }

  // Calculate final average with fixed weights
  let averageScore = 0;
  if (boxOfficeScore > 0 && criticalScore > 0) {
    averageScore = (boxOfficeScore * boxOfficeWeight) + (criticalScore * criticalWeight);
  } else if (boxOfficeScore > 0) {
    averageScore = boxOfficeScore;
  } else if (criticalScore > 0) {
    averageScore = criticalScore;
  }

  // Oscar Bonus - Added after averaging (+3 for nomination, +6 for winner)
  let oscarBonus = 0;
  if (data.oscarStatus === 'winner') {
    oscarBonus = 6;
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 3;
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
    criticsScore: Math.round(criticsScore * 100) / 100,
    audienceScore: Math.round(audienceScore * 100) / 100,
    criticalScore: Math.round(criticalScore * 100) / 100,
    consensusModifier: Math.round(consensusModifier * 1000) / 1000,
    boxOfficeAudienceModifier: 1, // No longer used, kept for compatibility
    adjustedBoxOfficeWeight: Math.round(boxOfficeWeight * 1000) / 1000,
    adjustedCriticalWeight: Math.round(criticalWeight * 1000) / 1000,
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
