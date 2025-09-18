import { supabase } from '@/integrations/supabase/client';
import { CategoryAnalysisRequest, CategoryAvailabilityResult } from '@/types/categoryTypes';

export class ProgressiveCategoryService {
  private static instance: ProgressiveCategoryService;
  private cache = new Map<string, CategoryAvailabilityResult>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  public static getInstance(): ProgressiveCategoryService {
    if (!ProgressiveCategoryService.instance) {
      ProgressiveCategoryService.instance = new ProgressiveCategoryService();
    }
    return ProgressiveCategoryService.instance;
  }

  private getCacheKey(category: string, theme: string, option: string, playerCount: number): string {
    return `${theme}-${option}-${playerCount}-${category}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  public async analyzeCategoryProgressive(
    request: CategoryAnalysisRequest,
    onCategoryComplete: (result: CategoryAvailabilityResult) => void
  ): Promise<CategoryAvailabilityResult[]> {
    const results: CategoryAvailabilityResult[] = [];
    const promises: Promise<void>[] = [];

    // Start analysis for each category
    for (const category of request.categories) {
      const promise = this.analyzeSingleCategory(category, request, onCategoryComplete);
      promises.push(promise);
    }

    // Wait for all to complete
    await Promise.all(promises);

    // Return results in original order
    return request.categories.map(category => {
      const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount);
      return this.cache.get(cacheKey)!;
    });
  }

  private async analyzeSingleCategory(
    category: string,
    request: CategoryAnalysisRequest,
    onComplete: (result: CategoryAvailabilityResult) => void
  ): Promise<void> {
    const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp || 0)) {
      onComplete(cached);
      return;
    }

    try {
      // Show estimated count immediately
      const estimatedResult = this.getEstimatedResult(category, request.playerCount);
      onComplete(estimatedResult);

      // Call edge function for single category
      const { data, error } = await supabase.functions.invoke('analyze-category-availability', {
        body: {
          ...request,
          categories: [category]
        }
      });

      if (error) throw error;

      const actualResult = data.results[0];
      if (actualResult) {
        const resultWithTimestamp = {
          ...actualResult,
          timestamp: Date.now()
        };
        
        this.cache.set(cacheKey, resultWithTimestamp);
        onComplete(resultWithTimestamp);
      }
    } catch (error) {
      console.error(`Error analyzing category ${category}:`, error);
      const errorResult: CategoryAvailabilityResult = {
        categoryId: category,
        available: false,
        movieCount: 0,
        sampleMovies: [],
        reason: 'Analysis failed',
        status: 'insufficient',
        timestamp: Date.now()
      };
      
      this.cache.set(cacheKey, errorResult);
      onComplete(errorResult);
    }
  }

  private getEstimatedResult(category: string, playerCount: number): CategoryAvailabilityResult {
    const estimates: Record<string, number> = {
      'Action/Adventure': 150,
      'Comedy': 120,
      'Drama/Romance': 200,
      'Sci-Fi/Fantasy': 80,
      'Animated': 60,
      'Horror/Thriller': 70,
      "30's": 15,
      "40's": 25,
      "50's": 35,
      "60's": 45,
      "70's": 40,
      "80's": 60,
      "90's": 100,
      "2000's": 120,
      "2010's": 150,
      "2020's": 50,
      'Academy Award Nominee or Winner': 80,
      'Blockbuster (minimum of $50 Mil)': 90
    };

    const estimatedCount = estimates[category] || 50;
    const status = this.getStatusFromCount(estimatedCount, playerCount);

    return {
      categoryId: category,
      available: estimatedCount >= playerCount,
      movieCount: estimatedCount,
      sampleMovies: [],
      status,
      isEstimate: true,
      timestamp: Date.now()
    };
  }

  private getStatusFromCount(count: number, playerCount: number): 'sufficient' | 'limited' | 'insufficient' {
    if (count >= playerCount * 2) return 'sufficient';
    if (count >= playerCount) return 'limited';
    return 'insufficient';
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public clearAllCaches(): void {
    this.cache.clear();
    // Clear localStorage cache as well for fresh analysis
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('category_validation_cache')) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}

export const progressiveCategoryService = ProgressiveCategoryService.getInstance();