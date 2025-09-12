import { supabase } from '@/integrations/supabase/client';
import { CategoryAnalysisRequest, CategoryAnalysisResponse, CategoryAvailabilityResult } from '@/types/categoryTypes';
import { getCategoryConfig } from '@/config/categoryConfigs';

export class CategoryValidationService {
  private static instance: CategoryValidationService;
  private cache = new Map<string, CategoryAnalysisResponse>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): CategoryValidationService {
    if (!CategoryValidationService.instance) {
      CategoryValidationService.instance = new CategoryValidationService();
    }
    return CategoryValidationService.instance;
  }

  private getCacheKey(request: CategoryAnalysisRequest): string {
    return `${request.theme}-${request.option}-${request.playerCount}-${request.categories.sort().join(',')}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  public async analyzeCategoryAvailability(request: CategoryAnalysisRequest): Promise<CategoryAnalysisResponse> {
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValidCache(cached.analysisTimestamp)) {
      return { ...cached, cacheHit: true };
    }

    try {
      // Call the edge function for analysis
      const { data, error } = await supabase.functions.invoke('analyze-category-availability', {
        body: request
      });

      if (error) {
        console.error('Error analyzing category availability:', error);
        throw error;
      }

      const response: CategoryAnalysisResponse = {
        results: data.results || [],
        analysisTimestamp: Date.now(),
        cacheHit: false
      };

      // Cache the response
      this.cache.set(cacheKey, response);

      return response;
    } catch (error) {
      console.error('Failed to analyze category availability:', error);
      
      // Return fallback data with estimated counts
      const fallbackResults = request.categories.map(category => {
        const config = getCategoryConfig(category);
        const estimatedCount = this.estimateMovieCount(category, request.theme);
        const requiredCount = config?.minMoviesRequired(request.playerCount) || request.playerCount * 1.5;
        
        return {
          categoryId: category,
          available: estimatedCount >= requiredCount,
          movieCount: estimatedCount,
          sampleMovies: [],
          reason: estimatedCount < requiredCount ? 'Insufficient movies available' : undefined,
          status: this.getStatusFromCount(estimatedCount, requiredCount)
        } as CategoryAvailabilityResult;
      });

      return {
        results: fallbackResults,
        analysisTimestamp: Date.now(),
        cacheHit: false
      };
    }
  }

  private estimateMovieCount(category: string, theme: string): number {
    // Rough estimates based on category popularity
    const estimates: Record<string, number> = {
      'Action/Adventure': 150,
      'Comedy': 120,
      'Drama/Romance': 200,
      'Sci-Fi/Fantasy': 80,
      'Animated': 60,
      'Horror/Thriller': 70,
      "70's": 40,
      "80's": 60,
      "90's": 100,
      "2000's": 120,
      "2010's": 150,
      "2020's": 50,
      'Academy Award Nominee or Winner': 80,
      'Blockbuster (minimum of $50 Mil)': 90
    };
    
    return estimates[category] || 50;
  }

  private getStatusFromCount(count: number, required: number): 'sufficient' | 'limited' | 'insufficient' {
    if (count >= required * 1.5) return 'sufficient';
    if (count >= required) return 'limited';
    return 'insufficient';
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public validateCategoriesForDraft(
    categories: string[],
    theme: string,
    playerCount: number
  ): Promise<CategoryAnalysisResponse> {
    return this.analyzeCategoryAvailability({
      theme,
      option: '', // Will be filled by edge function
      categories,
      playerCount
    });
  }
}

export const categoryValidationService = CategoryValidationService.getInstance();