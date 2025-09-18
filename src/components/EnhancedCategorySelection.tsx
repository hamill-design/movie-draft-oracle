import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { CheckboxIcon } from '@/components/icons/CheckboxIcon';
import { NAIcon } from '@/components/icons/NAIcon';
import { getCategoryConfig } from '@/config/categoryConfigs';

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

interface EnhancedCategorySelectionProps {
  selectedMovie: any;
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  picks: Pick[];
  currentPlayerId: number;
}

const CategoryButton = ({ 
  category, 
  isSelected, 
  isDisabled, 
  isEligible, 
  onClick, 
  tooltip 
}: {
  category: string;
  isSelected: boolean;
  isDisabled: boolean;
  isEligible: boolean;
  onClick: () => void;
  tooltip: string;
}) => {
  const config = getCategoryConfig(category);
  
  const getCategoryDisplayName = (category: string) => {
    if (category === 'Academy Award Nominee or Winner') return 'Academy Award';
    if (category === 'Blockbuster (minimum of $50 Mil)') return 'Blockbuster';
    return category;
  };

  const getButtonStyle = () => {
    if (isSelected) {
      return "w-full px-6 py-3 bg-brand-primary rounded text-ui-primary text-sm font-brockmann font-medium leading-5 text-center";
    }
    
    if (isDisabled) {
      return "w-full px-6 py-3 opacity-50 bg-greyscale-blue-200 rounded-md border border-greyscale-blue-300 flex items-center justify-center gap-2 cursor-not-allowed";
    }
    
    return "w-full px-6 py-3 bg-white rounded border border-greyscale-blue-200 text-text-primary text-sm font-brockmann font-medium leading-5 text-center hover:bg-[#EDEBFF] hover:outline hover:outline-1 hover:outline-[#BCB2FF] hover:outline-offset-[-1px] hover:text-[#2B2D2D] hover:border-transparent";
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={getButtonStyle()}
      title={tooltip}
    >
      <div className="flex items-center justify-center gap-2">
        <span className={isDisabled ? "text-greyscale-blue-800 text-sm font-brockmann font-medium" : "text-sm font-brockmann font-medium"}>
          {getCategoryDisplayName(category)}
        </span>
        {isDisabled && <NAIcon className="w-4 h-4 text-text-primary" />}
      </div>
    </button>
  );
};

const EnhancedCategorySelection = ({
  selectedMovie,
  categories,
  selectedCategory,
  onCategorySelect,
  picks,
  currentPlayerId
}: EnhancedCategorySelectionProps) => {
  if (!selectedMovie) return null;

  const [houseOverrideEnabled, setHouseOverrideEnabled] = useState(false);

  // Reset house override when movie changes
  useEffect(() => {
    setHouseOverrideEnabled(false);
  }, [selectedMovie?.id]);

  // Get eligible categories for the selected movie
  const eligibleCategories = useMemo(() => 
    getEligibleCategories(selectedMovie, categories), 
    [selectedMovie, categories]
  );

  const getCategoryTooltip = (category: string) => {
    const config = getCategoryConfig(category);
    let tooltip = `${category}\n${config?.description || ''}`;
    
    if (category === 'Academy Award Nominee or Winner' && selectedMovie.hasOscar) {
      tooltip += '\nThis movie has Academy Award nominations or wins';
    }
    if (category === 'Blockbuster (minimum of $50 Mil)' && selectedMovie.isBlockbuster) {
      const budget = selectedMovie.budget ? `$${(selectedMovie.budget / 1000000).toFixed(0)}M budget` : '';
      const revenue = selectedMovie.revenue ? `$${(selectedMovie.revenue / 1000000).toFixed(0)}M revenue` : '';
      tooltip += `\nThis movie is eligible: ${budget}${budget && revenue ? ', ' : ''}${revenue}`;
    }
    
    return tooltip;
  };

  const getEligibilityStatus = (category: string) => {
    const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
    const isEligible = eligibleCategories.includes(category);
    
    if (isAlreadyPicked) return { status: 'picked', icon: '', color: '#828786' };
    if (!isEligible) return { status: 'ineligible', icon: '', color: '#FF4444' };
    return { status: 'eligible', icon: '', color: '#06C995' };
  };

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aEligible = eligibleCategories.includes(a);
      const bEligible = eligibleCategories.includes(b);
      const aPicked = picks.some(p => p.playerId === currentPlayerId && p.category === a);
      const bPicked = picks.some(p => p.playerId === currentPlayerId && p.category === b);
      
      // Sort order: eligible first, then ineligible, then picked
      if (aEligible && !aPicked && (!bEligible || bPicked)) return -1;
      if (bEligible && !bPicked && (!aEligible || aPicked)) return 1;
      
      return 0;
    });
  }, [categories, eligibleCategories, picks, currentPlayerId]);

  return (
    <div className="w-full p-6 bg-greyscale-blue-100 shadow-[0px_0px_3px_rgba(0,0,0,0.25)] rounded flex flex-col gap-6">
      {/* Header Section */}
      <div className="w-full h-full flex flex-col gap-1.5">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 p-0.5 flex flex-col justify-center items-center gap-2.5">
              <CheckboxIcon className="w-6 h-6 text-[#680AFF]" />
            </div>
            <div className="flex-1 text-[#2B2D2D] text-xl font-brockmann font-medium leading-7">
              Select Category for {selectedMovie.title}
            </div>
          </div>
          
          {/* House Override Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-brockmann text-text-secondary">House Override</span>
            <Switch
              checked={houseOverrideEnabled}
              onCheckedChange={setHouseOverrideEnabled}
            />
          </div>
        </div>
        
        <div className="w-full flex flex-col">
          <div className="w-full flex flex-col gap-1">
            <div className="w-full flex flex-col">
              <div className="w-full text-[#828786] text-xs font-brockmann italic font-normal leading-4">
                Based on this movie's properties, you can select from {eligibleCategories.length} eligible categories.
              </div>
            </div>
            
            {/* Enhanced eligibility indicators */}
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedMovie.hasOscar && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
                  <span className="text-xs text-purple-700 font-brockmann">Oscar Eligible</span>
                </div>
              )}
              {selectedMovie.isBlockbuster && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
                  <span className="text-xs text-green-700 font-brockmann">Blockbuster</span>
                </div>
              )}
              {selectedMovie.genre && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full">
                  <span className="text-xs text-blue-700 font-brockmann">{selectedMovie.genre}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-[12px] gap-y-[12px]">
        {sortedCategories.map((category) => {
          const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
          const isEligible = eligibleCategories.includes(category);
          const isDisabled = isAlreadyPicked || (!isEligible && !houseOverrideEnabled);
          const isSelected = selectedCategory === category;
          
          return (
            <CategoryButton
              key={category}
              category={category}
              isSelected={isSelected}
              isDisabled={isDisabled}
              isEligible={isEligible}
              onClick={() => onCategorySelect(category)}
              tooltip={getCategoryTooltip(category)}
            />
          );
        })}
      </div>

      {/* Enhanced feedback messages */}
      {eligibleCategories.length === 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-red-700 font-brockmann font-medium">
              No eligible categories found
            </span>
          </div>
          <p className="text-red-600 text-sm mt-1 font-brockmann">
            This movie doesn't match any of the available categories. Please select a different movie that better fits your draft's theme and categories.
          </p>
        </div>
      )}

    </div>
  );
};

export default EnhancedCategorySelection;