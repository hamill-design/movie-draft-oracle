
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white">
          Select Category for "{selectedMovie.title}"
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((category) => {
            const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
            return (
              <Button
                key={category}
                onClick={() => onCategorySelect(category)}
                disabled={isAlreadyPicked}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`h-auto p-3 text-sm ${
                  selectedCategory === category
                    ? "bg-yellow-400 text-black hover:bg-yellow-500"
                    : isAlreadyPicked
                    ? "opacity-50 cursor-not-allowed"
                    : "border-gray-600 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {category}
                {isAlreadyPicked && <span className="ml-2">✓</span>}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CategorySelection;
