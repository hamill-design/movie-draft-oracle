
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { NAIcon } from '@/components/icons/NAIcon';

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

interface CategorySelectionProps {
  selectedMovie: any;
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  picks: Pick[];
  currentPlayerId: number;
}

const CategorySelection = ({
  selectedMovie,
  categories,
  selectedCategory,
  onCategorySelect,
  picks,
  currentPlayerId
}: CategorySelectionProps) => {
  if (!selectedMovie) return null;

  // Get eligible categories for the selected movie
  const eligibleCategories = getEligibleCategories(selectedMovie, categories);

  const getCategoryTooltip = (category: string) => {
    if (category === 'Academy Award Nominee or Winner' && selectedMovie.hasOscar) {
      return `This movie has Academy Award nominations or wins`;
    }
    if (category === 'Blockbuster (minimum of $50 Mil)' && selectedMovie.isBlockbuster) {
      const budget = selectedMovie.budget ? `$${(selectedMovie.budget / 1000000).toFixed(0)}M budget` : '';
      const revenue = selectedMovie.revenue ? `$${(selectedMovie.revenue / 1000000).toFixed(0)}M revenue` : '';
      return `This movie is eligible: ${budget}${budget && revenue ? ', ' : ''}${revenue}`;
    }
    return '';
  };

  return (
    <div className="w-full p-6 bg-greyscale-blue-100 shadow-[0px_0px_3px_rgba(0,0,0,0.25)] rounded flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col gap-1.5">
        {/* Title with Search Icon */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center p-0.5">
            <SearchIcon className="w-6 h-6 text-brand-primary" />
          </div>
          <div className="flex-1 text-text-primary text-xl font-brockmann font-medium leading-7">
            Search Movies featuring {selectedMovie.title}
          </div>
        </div>
        
        {/* Eligibility Information */}
        {eligibleCategories.length > 0 && (
          <div className="flex flex-col">
            <div className="text-greyscale-blue-500 text-xs font-brockmann italic leading-4">
              Based on this movie's properties, you can select from {eligibleCategories.length} eligible categories.
            </div>
            {selectedMovie.hasOscar && (
              <div className="text-brand-primary text-sm font-brockmann leading-5">
                Eligible for Academy Award category (Has Oscar nominations/wins)
              </div>
            )}
            {selectedMovie.isBlockbuster && (
              <div className="text-teal-600 text-sm font-brockmann leading-5">
                Eligible for Blockbuster category 
                {selectedMovie.budget > 0 && ` (Budget: $${(selectedMovie.budget / 1000000).toFixed(0)}M)`}
                {selectedMovie.revenue > 0 && ` (Revenue: $${(selectedMovie.revenue / 1000000).toFixed(0)}M)`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 justify-items-start">
        {categories.map((category) => {
          const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
          const isEligible = eligibleCategories.includes(category);
          const isDisabled = isAlreadyPicked || !isEligible;
          const isSelected = selectedCategory === category;
          
          if (isSelected) {
            return (
              <button
                key={category}
                onClick={() => onCategorySelect(category)}
                className="w-[294px] px-6 py-3 bg-brand-primary rounded text-ui-primary text-sm font-brockmann font-medium leading-5 text-center"
                title={getCategoryTooltip(category)}
              >
                {category}
              </button>
            );
          }
          
          if (isDisabled) {
            return (
              <button
                key={category}
                disabled
                className="w-[294px] px-6 py-3 opacity-50 bg-greyscale-blue-200 rounded-md border border-greyscale-blue-300 flex items-center justify-center gap-2 cursor-not-allowed"
                title={getCategoryTooltip(category)}
              >
                <span className="text-greyscale-blue-800 text-sm font-brockmann font-medium leading-5 text-center">
                  {category}
                </span>
                <NAIcon className="w-4 h-4 text-text-primary" />
              </button>
            );
          }
          
          return (
            <button
              key={category}
              onClick={() => onCategorySelect(category)}
              className="w-[294px] px-6 py-3 bg-white rounded border border-greyscale-blue-200 text-text-primary text-sm font-brockmann font-medium leading-5 text-center hover:bg-greyscale-blue-50"
              title={getCategoryTooltip(category)}
            >
              {category}
            </button>
          );
        })}
      </div>

      {eligibleCategories.length === 0 && (
        <div className="text-error-red-500 text-center mt-4 font-brockmann">
          This movie doesn't match any of the available categories. Please select a different movie.
        </div>
      )}
    </div>
  );
};

export default CategorySelection;
