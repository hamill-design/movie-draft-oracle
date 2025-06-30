
import React from 'react';
import { Movie } from '@/data/movies';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StarRating from './StarRating';

interface MovieScoringProps {
  movie: Movie;
  onScoreUpdate: (movieId: number, category: string, score: number) => void;
}

const MovieScoring: React.FC<MovieScoringProps> = ({ movie, onScoreUpdate }) => {
  const scoringCategories = [
    { key: 'plot', label: 'Plot' },
    { key: 'acting', label: 'Acting' },
    { key: 'cinematography', label: 'Cinematography' },
    { key: 'direction', label: 'Direction' },
    { key: 'overall', label: 'Overall' }
  ];

  const getAverageScore = () => {
    if (!movie.scores) return 0;
    const { overall, ...otherScores } = movie.scores;
    const scores = Object.values(otherScores);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>{movie.title}</span>
          <span className="text-2xl">{movie.poster}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scoringCategories.map((category) => (
          <div key={category.key} className="flex items-center justify-between">
            <label className="text-gray-300 font-medium min-w-[120px]">
              {category.label}:
            </label>
            <StarRating
              rating={movie.scores?.[category.key as keyof typeof movie.scores] || 0}
              onRatingChange={(score) => onScoreUpdate(movie.id, category.key, score)}
            />
          </div>
        ))}
        
        <div className="pt-3 border-t border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 font-semibold">Average Score:</span>
            <span className="text-yellow-400 font-bold text-lg">
              {getAverageScore().toFixed(1)}/5.0
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MovieScoring;
