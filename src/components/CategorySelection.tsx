
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';

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

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white">
          Select Category for "{selectedMovie.title}"
        </CardTitle>
        {eligibleCategories.length > 0 && (
          <p className="text-gray-400 text-sm">
            Based on this movie's properties, you can select from {eligibleCategories.length} eligible categories.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((category) => {
            const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
            const isEligible = eligibleCategories.includes(category);
            const isDisabled = isAlreadyPicked || !isEligible;
            
            return (
              <Button
                key={category}
                onClick={() => onCategorySelect(category)}
                disabled={isDisabled}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`h-auto p-3 text-sm ${
                  selectedCategory === category
                    ? "bg-yellow-400 text-black hover:bg-yellow-500"
                    : isDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : isEligible
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-red-600 text-red-400 opacity-50 cursor-not-allowed"
                }`}
              >
                {category}
                {isAlreadyPicked && <span className="ml-2">✓</span>}
                {!isEligible && !isAlreadyPicked && <span className="ml-2">✗</span>}
              </Button>
            );
          })}
        </div>
        {eligibleCategories.length === 0 && (
          <div className="text-red-400 text-center mt-4">
            This movie doesn't match any of the available categories. Please select a different movie.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategorySelection;
