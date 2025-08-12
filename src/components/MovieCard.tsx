
import React from 'react';
import { Movie } from '@/data/movies';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  onDraft: (movieId: number) => void;
  onRemove?: (movieId: number) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, onDraft, onRemove }) => {
  return (
    <Card className="bg-greyscale-900 border-greyscale-700 hover:border-yellow-400 transition-all duration-300 transform hover:scale-105">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="text-6xl mb-2">{movie.poster}</div>
          <Badge variant="secondary" className="bg-yellow-400 text-greyscale-1000">
            {movie.genre}
          </Badge>
        </div>
        <CardTitle className="text-greyscale-100 text-lg">{movie.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-greyscale-300 text-sm line-clamp-3">{movie.description}</p>
        
        <div className="flex items-center gap-4 text-greyscale-400 text-xs">
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            <span>{movie.year}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{movie.runtime}m</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-greyscale-400 text-xs">
          <User size={14} />
          <span>{movie.director}</span>
        </div>

        <div className="pt-2">
          {movie.isDrafted ? (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 border-error-red-500 text-error-red-400 hover:bg-error-red-500 hover:text-greyscale-100"
                onClick={() => onRemove?.(movie.id)}
              >
                Remove
              </Button>
              <Badge className="bg-positive-green-600 text-greyscale-100 px-3 py-1">
                Drafted ✓
              </Badge>
            </div>
          ) : (
            <Button 
              className="w-full bg-yellow-400 text-greyscale-1000 hover:bg-yellow-500"
              onClick={() => onDraft(movie.id)}
            >
              Draft Movie
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MovieCard;
