import React, { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxIcon } from '@/components/icons';
import { categoryValidationService } from '@/services/categoryValidationService';
import { CategoryAnalysisResponse, CategoryAvailabilityResult } from '@/types/categoryTypes';
import { getCategoryConfig } from '@/config/categoryConfigs';

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
  isAnalyzing
}: { 
  id: string; 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void; 
  availability?: CategoryAvailabilityResult;
  isAnalyzing: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const config = getCategoryConfig(category);
  
  const isDisabled = availability?.status === 'insufficient';

  const getCheckboxStyle = () => {
    let baseStyle = {
      width: 16,
      height: 16,
      borderRadius: 4,
      outline: '1px var(--Purple-300, #907AFF) solid',
      outlineOffset: '-1px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
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
        background: isHovered ? 'hsl(var(--purple-400))' : 'var(--Brand-Primary, #680AFF)',
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
      className="cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDisabled && onToggle(!isChecked)}
      title={getTooltipText()}
      style={{
        width: '100%',
        height: 20,
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 8,
        display: 'flex',
        paddingTop: '0px',
        paddingBottom: '0px',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer'
      }}
    >
      <div style={getCheckboxStyle()}>
        {getCheckmarkElement()}
      </div>
      
      <div className="flex items-center gap-2 flex-1">
        <span style={{
          color: 'hsl(var(--text-primary))',
          fontSize: 14,
          fontFamily: 'Brockmann',
          fontWeight: '500',
          lineHeight: '16px',
          margin: 0,
          padding: 0
        }}>
          {category}
        </span>

        {isAnalyzing && (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-primary"></div>
        )}

        {availability && !isAnalyzing && (
          <div className="flex items-center gap-1">
            <CategoryStatusIcon status={availability.status} />
            <span className="text-xs text-text-secondary">
              {availability.movieCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const EnhancedCategoriesForm = ({ form, categories, theme, playerCount, selectedOption, draftMode, participants = [] }: EnhancedCategoriesFormProps) => {
  const [analysisResult, setAnalysisResult] = useState<CategoryAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Validation guards to ensure proper setup before analysis
  const canAnalyze = () => {
    if (!theme || !selectedOption || categories.length === 0) return false;
    
    // For multiplayer, ensure participants are configured
    if (draftMode === 'multiplayer' && participants.length === 0) return false;
    
    // Ensure proper player count
    if (playerCount <= 0) return false;
    
    return true;
  };

  useEffect(() => {
    if (canAnalyze()) {
      analyzeCategories();
    } else {
      // Clear previous results if conditions aren't met
      setAnalysisResult(null);
      setIsAnalyzing(false);
    }
  }, [categories, theme, playerCount, selectedOption, draftMode, participants.length]);

  const analyzeCategories = async () => {
    if (!canAnalyze()) return;
    
    setIsAnalyzing(true);
    try {
      const result = await categoryValidationService.validateCategoriesForDraft(
        categories,
        theme,
        playerCount,
        selectedOption
      );
      setAnalysisResult(result);
    } catch (error) {
      console.error('Failed to analyze categories:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    const currentCategories = form.getValues('categories');
    const availability = analysisResult?.results.find(r => r.categoryId === category);
    
    // Prevent selection of insufficient categories
    if (checked && availability?.status === 'insufficient') {
      return;
    }
    
    if (checked) {
      form.setValue('categories', [...currentCategories, category]);
    } else {
      form.setValue('categories', currentCategories.filter(c => c !== category));
    }
  };

  const selectedCategories = form.watch('categories') || [];
  
  const getAvailabilityForCategory = (category: string) => {
    return analysisResult?.results.find(r => r.categoryId === category);
  };

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

      {/* Validation Status Message */}
      {!canAnalyze() && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 font-brockmann">
            {!selectedOption && "Please select a person or year first."}
            {selectedOption && draftMode === 'multiplayer' && participants.length === 0 && "Add participants to analyze category availability."}
            {selectedOption && categories.length === 0 && "Categories will be analyzed once available."}
          </p>
        </div>
      )}

      
      {/* Categories List */}
      <div 
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        {categories.map((category) => (
          <CustomCheckbox
            key={category}
            id={category}
            category={category}
            isChecked={selectedCategories.includes(category)}
            onToggle={(checked) => handleCategoryToggle(category, checked)}
            availability={getAvailabilityForCategory(category)}
            isAnalyzing={isAnalyzing}
          />
        ))}
      </div>

      {/* Warning for insufficient categories */}
      {analysisResult && analysisResult.results.some(r => r.status === 'insufficient') && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800 font-brockmann">
            Some categories have limited movie options. Consider selecting different categories for better draft variety.
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedCategoriesForm;