import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxIcon } from '@/components/icons';
import { categoryValidationService } from '@/services/categoryValidationService';
import { progressiveCategoryService } from '@/services/progressiveCategoryService';
import { CategoryAnalysisResponse, CategoryAvailabilityResult } from '@/types/categoryTypes';
import { getCategoryConfig, getCategoriesForTheme, getSpecCategoriesForActor } from '@/config/categoryConfigs';
import { getCleanActorName } from '@/lib/utils';

/**
 * Sort categories in the desired order:
 * 1. Spec categories (custom)
 * 2. Genres (Action/Adventure, Comedy, Drama/Romance, etc.)
 * 3. Decades chronologically (30's, 40's, 50's, 60's, 70's, 80's, 90's, 2000's, 2010's, 2020's)
 * 4. Academy Award and Blockbuster at the end
 */
const sortCategoriesForDisplay = (specCategories: string[], regularCategories: string[]): string[] => {
  // Define category groups
  const genreCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Horror/Thriller',
    'Sci-Fi/Fantasy'
  ];
  
  const decadeCategories = [
    "30's",
    "40's",
    "50's",
    "60's",
    "70's",
    "80's",
    "90's",
    "2000's",
    "2010's",
    "2020's"
  ];
  
  const endCategories = [
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)'
  ];
  
  // Separate regular categories into groups
  const genres: string[] = [];
  const decades: string[] = [];
  const end: string[] = [];
  const other: string[] = [];
  
  regularCategories.forEach(category => {
    if (genreCategories.includes(category)) {
      genres.push(category);
    } else if (decadeCategories.includes(category)) {
      decades.push(category);
    } else if (endCategories.includes(category)) {
      end.push(category);
    } else {
      other.push(category);
    }
  });
  
  // Sort genres in the defined order
  const sortedGenres = genreCategories.filter(cat => genres.includes(cat));
  
  // Sort decades chronologically
  const sortedDecades = decadeCategories.filter(cat => decades.includes(cat));
  
  // Sort end categories in the defined order
  const sortedEnd = endCategories.filter(cat => end.includes(cat));
  
  // Combine: spec categories first, then genres, then decades, then other, then end categories
  // Build array step by step to ensure correct order
  const sorted: string[] = [];
  
  // 1. Spec categories first
  sorted.push(...specCategories);
  
  // 2. Genres
  sorted.push(...sortedGenres);
  
  // 3. Decades chronologically
  sorted.push(...sortedDecades);
  
  // 4. Other categories
  sorted.push(...other);
  
  // 5. End categories (Academy Award and Blockbuster)
  sorted.push(...sortedEnd);
  
  console.log('🔍 Sorting categories - INPUT:', {
    specCategories,
    regularCategories,
    sortedGenres,
    sortedDecades,
    other,
    sortedEnd
  });
  
  // Verify the array was built correctly by checking each index
  console.log('🔍 VERIFICATION - Array contents by index:');
  for (let i = 0; i < sorted.length; i++) {
    console.log(`  [${i}]: "${sorted[i]}"`);
  }
  
  // Expected order verification
  const expectedFirst = specCategories.length > 0 ? specCategories[0] : sortedGenres[0];
  const actualFirst = sorted[0];
  console.log(`🔍 First item - Expected: "${expectedFirst}", Actual: "${actualFirst}"`);
  
  if (actualFirst !== expectedFirst) {
    console.error('❌ ARRAY ORDER IS WRONG! The first item does not match expected order!');
    console.error('Expected order:', [
      ...specCategories,
      ...sortedGenres,
      ...sortedDecades,
      ...other,
      ...sortedEnd
    ]);
    console.error('Actual order:', sorted);
  }
  
  console.log('✅ Sorting categories - OUTPUT:', {
    step1_specCategories: specCategories,
    step2_sortedGenres: sortedGenres,
    step3_sortedDecades: sortedDecades,
    step4_other: other,
    step5_sortedEnd: sortedEnd,
    finalJSON: JSON.stringify(sorted)
  });
  
  return sorted;
}

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface EnhancedCategoriesFormProps {
  form: UseFormReturn<DraftSetupForm>;
  categories: string[];
  theme: string;
  playerCount: number;
  selectedOption?: string;
  draftMode?: 'single' | 'multiplayer';
  participants?: string[];
}

const CategoryStatusIcon = ({ status }: { status: 'sufficient' | 'limited' | 'insufficient' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'sufficient': return '#06C995'; // Green
      case 'limited': return '#FFB800'; // Yellow/Orange
      case 'insufficient': return '#FF4444'; // Red
      default: return '#828786'; // Gray
    }
  };

  const getStatusSymbol = () => {
    switch (status) {
      case 'sufficient': return '';
      case 'limited': return '';
      case 'insufficient': return '';
      default: return '';
    }
  };

  return (
    <div 
      className="flex items-center justify-center rounded-full"
      style={{
        width: '16px',
        height: '16px',
        backgroundColor: getStatusColor(),
        color: 'white',
        fontSize: '10px',
        fontWeight: 'bold'
      }}
    >
      {getStatusSymbol()}
    </div>
  );
};

const CustomCheckbox = ({ 
  id, 
  category, 
  isChecked, 
  onToggle,
  availability,
  isAnalyzing,
  index
}: { 
  id: string; 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void; 
  availability?: CategoryAvailabilityResult;
  isAnalyzing: boolean;
  index: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const config = getCategoryConfig(category);
  
  const isDisabled = availability?.status === 'insufficient';

  const getCheckboxStyle = () => {
    let baseStyle = {
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      outline: '1px var(--Purple-300, #907AFF) solid',
      outlineOffset: '-1px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      display: 'flex'
    };
    
    if (isDisabled) {
      return {
        ...baseStyle,
        backgroundColor: '#F5F5F5',
        outline: '1px #CCCCCC solid',
        opacity: 0.5
      };
    }

    if (isChecked) {
      return {
        ...baseStyle,
        background: 'var(--Brand-Primary, #680AFF)',
      };
    } else {
      return baseStyle;
    }
  };

  const getCheckmarkElement = () => {
    if (isDisabled) return null;
    
    if (isChecked || isHovered) {
      const strokeColor = isChecked ? 'white' : 'var(--Purple-300, #907AFF)';
      return (
        <svg width="9.33" height="6.42" viewBox="0 0 12 8" fill="none">
          <path 
            d="M10.6667 0.791687L4.25 7.20835L1.33333 4.29169" 
            stroke={strokeColor} 
            strokeWidth="1.16667" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    
    return null;
  };

  const getCountBadgeStyle = () => {
    if (!availability) return { display: 'none' };
    
    let backgroundColor = 'var(--Utility-Colors-Positive-Green-200, #ADF2CC)';
    let borderColor = 'var(--Utility-Colors-Positive-Green-500, #13CE66)';
    
    if (availability.status === 'limited') {
      backgroundColor = 'var(--Utility-Colors-Warning-Yellow-200, #FFF2CC)';
      borderColor = 'var(--Utility-Colors-Warning-Yellow-500, #FFB800)';
    } else if (availability.status === 'insufficient') {
      backgroundColor = 'var(--Utility-Colors-Negative-Red-200, #FFCCCC)';
      borderColor = 'var(--Utility-Colors-Negative-Red-500, #FF4444)';
    }
    
    return {
      paddingLeft: '4px',
      paddingRight: '4px',
      paddingTop: '2px',
      paddingBottom: '2px',
      background: backgroundColor,
      borderRadius: '4px',
      outline: `1px ${borderColor} solid`,
      outlineOffset: '-1px',
      justifyContent: 'flex-start',
      alignItems: 'center',
      display: 'flex'
    };
  };

  const getTooltipText = () => {
    if (isAnalyzing) return 'Analyzing availability...';
    if (!availability) return category;
    
    let tooltip = `${category}\n`;
    tooltip += `${availability.movieCount} movies available\n`;
    
    if (availability.sampleMovies.length > 0) {
      tooltip += `Examples: ${availability.sampleMovies.slice(0, 3).join(', ')}`;
      if (availability.sampleMovies.length > 3) tooltip += '...';
    }
    
    if (availability.reason) {
      tooltip += `\n${availability.reason}`;
    }
    
    return tooltip;
  };

  return (
    <div 
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '8px',
        display: 'inline-flex',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDisabled && onToggle(!isChecked)}
      title={getTooltipText()}
    >
      <div style={getCheckboxStyle()}>
        {getCheckmarkElement()}
      </div>
      
      <div style={{
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'inline-flex'
      }}>
        <div style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--Text-Primary, #2B2D2D)',
          fontSize: '14px',
          fontFamily: 'Brockmann',
          fontWeight: '500',
          lineHeight: '20px',
          wordWrap: 'break-word'
        }}>
          {category}
        </div>
      </div>
      
      {isAnalyzing ? (
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-primary ml-2"></div>
      ) : (
        <div style={getCountBadgeStyle()}>
          <div style={{
            textAlign: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--Text-Primary, #2B2D2D)',
            fontSize: '12px',
            fontFamily: 'Brockmann',
            fontWeight: '400',
            lineHeight: '16px',
            wordWrap: 'break-word'
          }}>
            {availability?.isEstimate ? `~${availability.movieCount}` : availability?.movieCount || '00'}
          </div>
        </div>
      )}
    </div>
  );
};

const EnhancedCategoriesForm = ({ form, categories, theme, playerCount, selectedOption, draftMode, participants = [] }: EnhancedCategoriesFormProps) => {
  const [analysisResult, setAnalysisResult] = useState<CategoryAnalysisResponse | null>(null);
  const [progressiveResults, setProgressiveResults] = useState<Map<string, CategoryAvailabilityResult>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [specCategories, setSpecCategories] = useState<string[]>([]);
  const [specCategoryCounts, setSpecCategoryCounts] = useState<Map<string, number>>(new Map());
  const [allCategories, setAllCategories] = useState<string[]>(() => sortCategoriesForDisplay([], categories));
  const isHandlingErrorRefresh = useRef(false);
  const lastAnalysisKey = useRef<string>('');
  const isAnalyzingRef = useRef(false);
  const analysisResultRef = useRef<CategoryAnalysisResponse | null>(null);

  // Fetch spec categories for people themes
  useEffect(() => {
    const fetchSpecCategories = async () => {
      if (theme === 'people' && selectedOption) {
        try {
          const actorName = getCleanActorName(selectedOption);
          
          // Fetch spec categories directly to get movie counts
          const { supabase } = await import('@/integrations/supabase/client');
          // Use 'from' in a way that bypasses type inference errors since this is a dynamic relation
          let { data, error } = await (supabase as any)
            .from('actor_spec_categories')
            .select('category_name, movie_tmdb_ids')
            .eq('actor_name', actorName);

          if (error || !data || data.length === 0) {
            ({ data, error } = await (supabase as any)
              .from('actor_spec_categories')
              .select('category_name, movie_tmdb_ids')
              .ilike('actor_name', `%${actorName}%`));
          }
          if (error || !data || data.length === 0) {
            setSpecCategories([]);
            setSpecCategoryCounts(new Map());
            // Sort regular categories even when no spec categories found
            const sortedCategories = sortCategoriesForDisplay([], categories);
            const freshArray = Array.from(sortedCategories);
            setAllCategories(freshArray);
            return;
          }
          
          // Extract category names and counts
          const specCategoryNames = data.map((row: any) => row.category_name);
          const countsMap = new Map<string, number>();
          
          data.forEach((row: any) => {
            const count = row.movie_tmdb_ids?.length || 0;
            countsMap.set(row.category_name, count);
          });
          
          setSpecCategories(specCategoryNames);
          setSpecCategoryCounts(countsMap);
          
          // Sort categories: spec categories first, then genres, then decades chronologically, then Academy Award and Blockbuster
          const sortedCategories = sortCategoriesForDisplay(specCategoryNames, categories);
          // Create a completely fresh array to prevent any reference issues
          const freshArray = Array.from(sortedCategories);
          console.log('📝 BEFORE setState - freshArray:', JSON.stringify(freshArray));
          console.log('📝 BEFORE setState - first item:', freshArray[0]);
          setAllCategories(freshArray);
        } catch (err) {
          console.error('Failed to fetch spec categories:', err);
          setSpecCategories([]);
          setSpecCategoryCounts(new Map());
          // Sort regular categories even on error
          const sortedCategories = sortCategoriesForDisplay([], categories);
          const freshArray = Array.from(sortedCategories);
          setAllCategories(freshArray);
        }
      } else {
        setSpecCategories([]);
        setSpecCategoryCounts(new Map());
        // Sort regular categories even when no spec categories
        const sortedCategories = sortCategoriesForDisplay([], categories);
        const freshArray = Array.from(sortedCategories);
        console.log('📝 Setting allCategories (no spec):', freshArray);
        setAllCategories(freshArray);
      }
    };

    fetchSpecCategories();
  }, [theme, selectedOption, categories]);

  // Debug: Log whenever allCategories changes
  useEffect(() => {
    console.log('🔄 allCategories state changed:', JSON.stringify(allCategories));
    console.log('🔄 allCategories first item:', allCategories[0]);
  }, [allCategories]);

  // Force clear cache for person-based themes on component mount
  useEffect(() => {
    const isPersonTheme = theme === 'people';
    if (isPersonTheme) {
      progressiveCategoryService.forceRefreshPersonThemes();
    }
  }, [theme]);

  // More permissive analysis - similar to local drafting
  const canAnalyze = () => {
    return theme && selectedOption && allCategories.length > 0;
  };

  // Keep refs in sync with state
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  useEffect(() => {
    analysisResultRef.current = analysisResult;
  }, [analysisResult]);

  const preAnalyzeAllCategories = useCallback(async () => {
    // Prevent concurrent analysis calls
    if (isAnalyzingRef.current) {
      console.warn('⚠️ Analysis already in progress, skipping');
      return;
    }

    // Create a unique key for this analysis to prevent duplicate calls
    const analysisKey = `${theme}-${selectedOption}-${allCategories.join(',')}-${playerCount}-${draftMode}`;
    if (lastAnalysisKey.current === analysisKey && analysisResultRef.current) {
      console.warn('⚠️ Analysis already completed for this configuration, skipping');
      return;
    }

    try {
      setIsAnalyzing(true);
      lastAnalysisKey.current = analysisKey;
      
      // Use allCategories which includes spec categories for people themes
      if (allCategories.length > 0) {
        // Added defensive checks for required values and normalized draftMode fallback
        if (!theme || theme.trim() === '' || !selectedOption || selectedOption.trim() === '') {
          console.warn('⚠️ Skipping pre-analysis: theme or selectedOption is empty', { theme, selectedOption });
          throw new Error('Theme and selectedOption are required for category analysis.');
        }
        console.log('🔍 Pre-analyzing categories:', { theme, option: selectedOption, categories: allCategories, playerCount, draftMode });
        const result = await categoryValidationService.analyzeCategoryAvailability({
          theme,
          option: selectedOption,
          categories: allCategories,
          playerCount,
          draftMode: draftMode ?? 'single'
        });
        
        console.log('✅ Pre-analysis result:', JSON.stringify(result, null, 2));
        console.log('✅ Pre-analysis results array:', JSON.stringify(result?.results, null, 2));
        console.log('✅ Pre-analysis results count:', result?.results?.length);
        if (result?.results && result.results.length > 0) {
          console.log('✅ First result:', JSON.stringify(result.results[0], null, 2));
          console.log('✅ All results:', result.results.map(r => ({ category: r.categoryId, count: r.movieCount, status: r.status, reason: r.reason })));
          console.log('✅ Sample of results (first 3):', JSON.stringify(result.results.slice(0, 3), null, 2));
        } else {
          console.warn('⚠️ No results in analysis response!');
        }
        setAnalysisResult(result);
      }
    } catch (err) {
      console.error('❌ Failed to pre-analyze categories:', err);
      lastAnalysisKey.current = ''; // Reset on error to allow retry
    } finally {
      setIsAnalyzing(false);
    }
  }, [theme, selectedOption, allCategories, playerCount, draftMode]);

  // Effect to detect and handle error results
  useEffect(() => {
    if (!analysisResult || !analysisResult.results) return;
    
    // Prevent infinite loops - don't handle errors if we're already handling them or analyzing
    if (isHandlingErrorRefresh.current || isAnalyzingRef.current) {
      return;
    }
    
    // Check if results contain errors
    const hasErrors = analysisResult.results.some(result => 
      result.reason?.includes('Analysis failed') || 
      (result.movieCount === 0 && result.status === 'insufficient' && result.reason)
    );
    
    // If we have error results and it's from cache, clear cache and force refresh
    if (hasErrors && analysisResult.cacheHit) {
      console.warn('⚠️ Detected error results from cache, clearing and forcing refresh');
      isHandlingErrorRefresh.current = true;
      categoryValidationService.clearErrorCaches();
      
      // Force a fresh analysis
      if (theme && selectedOption && allCategories.length > 0) {
        console.log('🔄 Forcing fresh analysis after clearing error cache');
        preAnalyzeAllCategories().finally(() => {
          // Reset the flag after a delay to allow the new result to come in
          setTimeout(() => {
            isHandlingErrorRefresh.current = false;
          }, 1000);
        });
      } else {
        isHandlingErrorRefresh.current = false;
      }
    } else if (hasErrors && !analysisResult.cacheHit) {
      // Fresh error results - don't cache them (already handled in service)
      console.warn('⚠️ Received error results from edge function - these will not be cached');
    }
  }, [analysisResult, theme, selectedOption, allCategories]);

  // Effect for pre-analysis - triggers as soon as theme and option are selected
  useEffect(() => {
    // Don't trigger if we're already analyzing or handling an error refresh
    if (isAnalyzingRef.current || isHandlingErrorRefresh.current) {
      return;
    }

    console.log('🔔 Pre-analysis effect triggered:', JSON.stringify({ 
      theme, 
      selectedOption, 
      themeType: typeof theme,
      selectedOptionType: typeof selectedOption,
      themeTruthy: !!theme,
      selectedOptionTruthy: !!selectedOption,
      allCategoriesLength: allCategories.length, 
      playerCount, 
      draftMode 
    }, null, 2));
    if (theme && selectedOption && allCategories.length > 0) {
      console.log('✅ Conditions met, calling preAnalyzeAllCategories');
      preAnalyzeAllCategories();
    } else {
      console.warn('⚠️ Pre-analysis conditions not met:', JSON.stringify({
        hasTheme: !!theme,
        themeValue: theme,
        hasSelectedOption: !!selectedOption,
        selectedOptionValue: selectedOption,
        hasCategories: allCategories.length > 0
      }, null, 2));
    }
  }, [theme, selectedOption, playerCount, allCategories, draftMode]);

  // Effect for UI state management - clears results when conditions aren't met
  useEffect(() => {
    if (!canAnalyze()) {
      setAnalysisResult(null);
      setIsAnalyzing(false);
    }
  }, [allCategories, theme, selectedOption]);

  const analyzeCategories = async () => {
    if (!canAnalyze()) return;
    
    setIsAnalyzing(true);
    setProgressiveResults(new Map());
    
    // Person theme uses stronger cache refresh; also refresh if any decade categories are selected
    const isPersonTheme = theme === 'people';
    const includesDecadeCategories = allCategories.some(c => c.includes("'s"));
    
    try {
      // Use progressive loading for better UX, force refresh for person themes
      await progressiveCategoryService.analyzeCategoryProgressive(
        {
          theme,
          option: selectedOption,
          categories: allCategories,
          playerCount,
          draftMode: draftMode || 'single'
        },
        (result) => {
          setProgressiveResults(prev => new Map(prev).set(result.categoryId, result));
        },
        isPersonTheme || includesDecadeCategories // Force refresh for person/decode categories to avoid stale counts
      );
    } catch (error) {
      console.error('Failed to analyze categories:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getAvailabilityForCategory = (category: string) => {
    // For spec categories, use the direct count from database
    if (specCategories.includes(category)) {
      const movieCount = specCategoryCounts.get(category) || 0;
      const requiredCount = playerCount;
      const status = movieCount >= requiredCount ? 'sufficient' : 
                     movieCount > 0 ? 'limited' : 'insufficient';
      
      return {
        categoryId: category,
        available: movieCount >= requiredCount,
        movieCount: movieCount,
        sampleMovies: [],
        status: status as 'sufficient' | 'limited' | 'insufficient',
        isEstimate: false
      };
    }
    
    // Check progressive results first, fallback to analysis result
    const progressiveResult = progressiveResults.get(category);
    if (progressiveResult) {
      console.log(`📊 Progressive result for "${category}":`, progressiveResult);
      return progressiveResult;
    }
    
    const analysisResultForCategory = analysisResult?.results?.find(r => r.categoryId === category);
    if (!analysisResultForCategory && analysisResult) {
      console.log(`⚠️ No result found for "${category}" in analysisResult. Available categories:`, analysisResult.results.map(r => r.categoryId));
    }
    
    return analysisResultForCategory;
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    console.log(`🔄 handleCategoryToggle called for "${category}":`, checked);
    const currentCategories = form.getValues('categories');
    // Use getAvailabilityForCategory to get the correct availability for both spec and regular categories
    const availability = getAvailabilityForCategory(category);
    console.log(`📊 Availability for "${category}":`, availability);
    
    // Prevent selection of insufficient categories
    if (checked && availability?.status === 'insufficient') {
      console.log(`❌ Blocked selection of "${category}" - insufficient`);
      return;
    }
    
    if (checked) {
      const newCategories = [...currentCategories, category];
      console.log(`✅ Adding "${category}" to categories:`, newCategories);
      form.setValue('categories', newCategories);
    } else {
      const newCategories = currentCategories.filter(c => c !== category);
      console.log(`✅ Removing "${category}" from categories:`, newCategories);
      form.setValue('categories', newCategories);
    }
  };

  const selectedCategories = form.watch('categories') || [];

  const getSummaryStats = () => {
    if (!analysisResult) return null;
    
    const sufficient = analysisResult.results.filter(r => r.status === 'sufficient').length;
    const limited = analysisResult.results.filter(r => r.status === 'limited').length;
    const insufficient = analysisResult.results.filter(r => r.status === 'insufficient').length;
    
    return { sufficient, limited, insufficient };
  };

  const summaryStats = getSummaryStats();

  return (
    <div 
      className="w-full bg-greyscale-blue-100 rounded-lg flex flex-col"
      style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)', padding: '24px', gap: '24px'}}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex justify-center items-center" style={{ width: '24px', height: '24px', padding: '2px' }}>
          <CheckboxIcon className="text-primary" />
        </div>
        <span className="text-foreground text-xl font-brockmann font-medium leading-7">
          Choose Categories
        </span>
      </div>

      {/* Categories Grid */}
      <div 
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        {useMemo(() => {
          // Create a fresh copy to ensure correct order
          const categoriesToRender = [...allCategories];
          console.log('🎨 Rendering allCategories - length:', categoriesToRender.length);
          console.log('🎨 Rendering allCategories - first item:', categoriesToRender[0]);
          console.log('🎨 Rendering allCategories - JSON:', JSON.stringify(categoriesToRender));
          return categoriesToRender;
        }, [allCategories]).map((category, index) => {
          const categoryConfig = getCategoryConfig(category);
          const isSpecCategory = specCategories.includes(category);
          const availability = getAvailabilityForCategory(category);
          
          // Debug logging for all categories
          if (index < 3) { // Log first 3 categories for debugging
            const analysisResultForCat = analysisResult?.results?.find(r => r.categoryId === category);
            console.log(`🔍 Category "${category}":`, JSON.stringify({
              availability: availability ? {
                categoryId: availability.categoryId,
                movieCount: availability.movieCount,
                status: availability.status,
                reason: availability.reason
              } : null,
              movieCount: availability?.movieCount,
              status: availability?.status,
              isSpecCategory,
              specCount: isSpecCategory ? specCategoryCounts.get(category) : null,
              progressiveResult: progressiveResults.get(category) ? {
                categoryId: progressiveResults.get(category)?.categoryId,
                movieCount: progressiveResults.get(category)?.movieCount,
                status: progressiveResults.get(category)?.status
              } : null,
              analysisResult: analysisResultForCat ? JSON.stringify(analysisResultForCat, null, 2) : null,
              analysisResultExists: !!analysisResult,
              analysisResultsLength: analysisResult?.results?.length,
              analysisResultCategoryIds: analysisResult?.results?.map(r => r.categoryId)
            }, null, 2));
          }
          
          // Debug logging for spec categories
          if (isSpecCategory) {
            console.log(`🔍 Spec category "${category}":`, {
              availability,
              isDisabled: availability?.status === 'insufficient',
              movieCount: specCategoryCounts.get(category),
              playerCount
            });
          }
          
          return (
            <CustomCheckbox
              key={category}
              id={category}
              category={category}
              isChecked={selectedCategories.includes(category)}
              onToggle={(checked) => {
                console.log(`🖱️ Toggle clicked for "${category}":`, checked);
                handleCategoryToggle(category, checked);
              }}
              availability={availability}
              isAnalyzing={isAnalyzing}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedCategoriesForm;