import { useState, useEffect, useCallback } from 'react';
import { categoryValidationService } from '@/services/categoryValidationService';
import { progressiveCategoryService } from '@/services/progressiveCategoryService';
import { CategoryAnalysisResponse } from '@/types/categoryTypes';

export const useCategoryValidation = (
  theme: string,
  categories: string[],
  playerCount: number
) => {
  const [analysisResult, setAnalysisResult] = useState<CategoryAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeCategories = useCallback(async () => {
    if (!theme || categories.length === 0 || playerCount <= 0) {
      setAnalysisResult(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await categoryValidationService.analyzeCategoryAvailability({
        theme,
        option: '', // Will be filled by the service
        categories,
        playerCount
      });
      
      setAnalysisResult(result);
    } catch (err) {
      console.error('Failed to analyze categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze categories');
    } finally {
      setIsAnalyzing(false);
    }
  }, [theme, categories, playerCount]);

  useEffect(() => {
    analyzeCategories();
  }, [analyzeCategories]);

  const getAvailabilityForCategory = useCallback((categoryName: string) => {
    return analysisResult?.results.find(r => r.categoryId === categoryName);
  }, [analysisResult]);

  const getInsufficientCategories = useCallback(() => {
    return analysisResult?.results.filter(r => r.status === 'insufficient') || [];
  }, [analysisResult]);

  const getSummaryStats = useCallback(() => {
    if (!analysisResult) return null;
    
    const sufficient = analysisResult.results.filter(r => r.status === 'sufficient').length;
    const limited = analysisResult.results.filter(r => r.status === 'limited').length;
    const insufficient = analysisResult.results.filter(r => r.status === 'insufficient').length;
    
    return { sufficient, limited, insufficient, total: analysisResult.results.length };
  }, [analysisResult]);

  const canCreateDraft = useCallback((selectedCategories: string[]) => {
    if (!analysisResult || selectedCategories.length === 0) return false;
    
    // Check if all selected categories have sufficient or limited availability
    return selectedCategories.every(category => {
      const availability = getAvailabilityForCategory(category);
      return availability && availability.status !== 'insufficient';
    });
  }, [analysisResult, getAvailabilityForCategory]);

  const refreshAnalysis = useCallback(() => {
    categoryValidationService.clearAllCaches();
    progressiveCategoryService.clearAllCaches();
    analyzeCategories();
  }, [analyzeCategories]);

  return {
    analysisResult,
    isAnalyzing,
    error,
    getAvailabilityForCategory,
    getInsufficientCategories,
    getSummaryStats,
    canCreateDraft,
    refreshAnalysis
  };
};