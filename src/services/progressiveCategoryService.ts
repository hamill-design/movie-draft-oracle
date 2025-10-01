import { supabase } from '@/integrations/supabase/client';
import { CategoryAnalysisRequest, CategoryAvailabilityResult } from '@/types/categoryTypes';

export class ProgressiveCategoryService {
  private static instance: ProgressiveCategoryService;
  private cache = new Map<string, CategoryAvailabilityResult>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly DECEASED_ACTOR_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for deceased actors
  private readonly CACHE_VERSION = 'v2.2.0'; // Increment when posthumous logic changes - enhanced documentary filtering

  public static getInstance(): ProgressiveCategoryService {
    if (!ProgressiveCategoryService.instance) {
      ProgressiveCategoryService.instance = new ProgressiveCategoryService();
    }
    return ProgressiveCategoryService.instance;
  }

  private getCacheKey(category: string, theme: string, option: string, playerCount: number, draftMode?: string): string {
    // For non-person themes, don't include playerCount since the raw movie count doesn't change
    const isPersonTheme = this.isPersonBasedTheme(theme);
    if (isPersonTheme) {
      return `${this.CACHE_VERSION}-${theme}-${option}-${draftMode || 'single'}-${playerCount}-${category}`;
    }
    return `${this.CACHE_VERSION}-${theme}-${option}-${draftMode || 'single'}-${category}`;
  }

  private isPersonBasedTheme(theme: string): boolean {
    return theme === 'actor' || theme === 'actress' || theme === 'director';
  }

  private getStatusFromCountDynamic(count: number, playerCount: number): 'sufficient' | 'limited' | 'insufficient' {
    const required = playerCount * 5;
    if (count >= required) return 'sufficient';
    if (count > 0) return 'limited';
    return 'insufficient';
  }

  private getCacheDuration(theme: string): number {
    // Use shorter cache for person-based themes to ensure fresh posthumous logic
    return this.isPersonBasedTheme(theme) ? this.DECEASED_ACTOR_CACHE_DURATION : this.CACHE_DURATION;
  }

  private isValidCache(timestamp: number, theme: string): boolean {
    const duration = this.getCacheDuration(theme);
    return Date.now() - timestamp < duration;
  }

  public async analyzeCategoryProgressive(
    request: CategoryAnalysisRequest,
    onCategoryComplete: (result: CategoryAvailabilityResult) => void,
    forceRefresh: boolean = false
  ): Promise<CategoryAvailabilityResult[]> {
    // Clear cache for person-based themes or when forced
    if (forceRefresh || this.isPersonBasedTheme(request.theme)) {
      this.clearPersonBasedCache(request.theme);
    }

    // Immediately show estimated results for all categories
    const estimatedResults = request.categories.map(category => {
      const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount, request.draftMode);
      
      // Check cache first
      if (!forceRefresh && !this.isPersonBasedTheme(request.theme)) {
        const cached = this.cache.get(cacheKey);
        if (cached && this.isValidCache(cached.timestamp || 0, request.theme)) {
          // For non-person themes, recalculate status based on current playerCount
          const updatedResult = {
            ...cached,
            status: this.getStatusFromCountDynamic(cached.movieCount, request.playerCount)
          };
          onCategoryComplete(updatedResult);
          return updatedResult;
        }
      }

      // Show estimated result immediately
      const estimatedResult = this.getEstimatedResult(category, request.playerCount);
      onCategoryComplete(estimatedResult);
      return estimatedResult;
    });

    // Make a single batched API call for all categories that need analysis
    const categoriesToAnalyze = request.categories.filter(category => {
      const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount, request.draftMode);
      const cached = this.cache.get(cacheKey);
      return forceRefresh || this.isPersonBasedTheme(request.theme) || 
             !cached || !this.isValidCache(cached.timestamp || 0, request.theme);
    });

    if (categoriesToAnalyze.length > 0) {
      try {
        // Single API call for all categories
        const { data, error } = await supabase.functions.invoke('analyze-category-availability', {
          body: {
            ...request,
            categories: categoriesToAnalyze
          }
        });

        if (error) throw error;

        // Process results and update cache
        data.results?.forEach((result: CategoryAvailabilityResult) => {
          const resultWithTimestamp = {
            ...result,
            timestamp: Date.now()
          };
          
          const cacheKey = this.getCacheKey(result.categoryId, request.theme, request.option, request.playerCount, request.draftMode);
          this.cache.set(cacheKey, resultWithTimestamp);
          onCategoryComplete(resultWithTimestamp);
        });
      } catch (error) {
        console.error('Error analyzing categories:', error);
        // Provide error fallbacks
        categoriesToAnalyze.forEach(category => {
          const errorResult: CategoryAvailabilityResult = {
            categoryId: category,
            available: false,
            movieCount: 0,
            sampleMovies: [],
            reason: 'Analysis failed',
            status: 'insufficient',
            timestamp: Date.now()
          };
          
          const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount, request.draftMode);
          this.cache.set(cacheKey, errorResult);
          onCategoryComplete(errorResult);
        });
      }
    }

    // Return final results
    return request.categories.map(category => {
      const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount, request.draftMode);
      return this.cache.get(cacheKey)!;
    });
  }

  private async analyzeSingleCategory(
    category: string,
    request: CategoryAnalysisRequest,
    onComplete: (result: CategoryAvailabilityResult) => void,
    forceRefresh: boolean = false
  ): Promise<void> {
    const cacheKey = this.getCacheKey(category, request.theme, request.option, request.playerCount, request.draftMode);
    
    // Check cache first (unless force refresh or person-based theme)
    if (!forceRefresh && !this.isPersonBasedTheme(request.theme)) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isValidCache(cached.timestamp || 0, request.theme)) {
        // For non-person themes, recalculate status based on current playerCount
        const updatedResult = {
          ...cached,
          status: this.getStatusFromCountDynamic(cached.movieCount, request.playerCount)
        };
        onComplete(updatedResult);
        return;
      }
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

  private clearPersonBasedCache(theme: string): void {
    // Clear cache entries for person-based themes
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(theme) || this.isPersonBasedTheme(theme)
    );
    keysToDelete.forEach(key => this.cache.delete(key));

    // Clear localStorage entries too
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('category_validation_cache') && key.includes(theme)) {
          localStorage.removeItem(key);
        }
      });
    }
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

  public forceRefreshPersonThemes(): void {
    // Clear all person-based cached data and force fresh analysis
    this.clearPersonBasedCache('actor');
    this.clearPersonBasedCache('actress');
    this.clearPersonBasedCache('director');
  }
}

export const progressiveCategoryService = ProgressiveCategoryService.getInstance();