export interface CategoryValidationRule {
  type: 'minMovies' | 'themeCompatible' | 'yearRange';
  config: any;
}

export interface CategoryConfig {
  id: string;
  name: string;
  description: string;
  minMoviesRequired: (playerCount: number) => number;
  validationRules: CategoryValidationRule[];
  themes: string[]; // Which themes this category applies to
  popularity: 'high' | 'medium' | 'low';
  icon?: string;
  alwaysAvailable?: boolean; // If true, category is always available regardless of validation
}

export interface CategoryAvailabilityResult {
  categoryId: string;
  available: boolean;
  movieCount: number;
  sampleMovies: string[];
  reason?: string;
  status: 'sufficient' | 'limited' | 'insufficient';
  isEstimate?: boolean;
  timestamp?: number;
}

export interface CategoryAnalysisRequest {
  theme: string;
  option: string;
  categories: string[];
  playerCount: number;
  draftMode?: 'single' | 'multiplayer';
}

export interface CategoryAnalysisResponse {
  results: CategoryAvailabilityResult[];
  analysisTimestamp: number;
  cacheHit: boolean;
}