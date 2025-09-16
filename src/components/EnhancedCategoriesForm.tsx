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
    
    if (isChecked) {
      return (
        <div style={{
          width: '9.33px',
          height: '6.42px',
          outline: '1.17px var(--UI-Primary, white) solid',
          outlineOffset: '-0.58px'
        }} />
      );
    }
    
    if (isHovered && !isChecked) {
      return (
        <div style={{
          width: '9.33px',
          height: '6.42px',
          outline: '1.17px var(--Purple-300, #907AFF) solid',
          outlineOffset: '-0.58px'
        }} />
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
            {availability?.movieCount || '00'}
          </div>
        </div>
      )}
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

      {/* Categories Grid */}
      <div 
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        {categories.map((category, index) => (
          <CustomCheckbox
            key={category}
            id={category}
            category={category}
            isChecked={selectedCategories.includes(category)}
            onToggle={(checked) => handleCategoryToggle(category, checked)}
            availability={getAvailabilityForCategory(category)}
            isAnalyzing={isAnalyzing}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default EnhancedCategoriesForm;