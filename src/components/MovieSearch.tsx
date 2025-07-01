
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Movie {
  id: string;
  title: string;
  year: string;
  genre: string;
}

interface MovieSearchProps {
  theme: string;
  option: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  movies: Movie[];
  loading: boolean;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
}

const MovieSearch = ({
  theme,
  option,
  searchQuery,
  onSearchChange,
  movies,
  loading,
  selectedMovie,
  onMovieSelect
}: MovieSearchProps) => {
  const searchTerm = searchQuery || option;

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="text-yellow-400" size={24} />
          Search {theme === 'year' ? 'Movies' : 'Movies/Shows'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder={`Search for ${theme === 'year' ? 'movies from ' + option : 'movies with ' + option}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
        />
        
        {searchTerm && (
          <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-gray-400">Searching...</div>
            ) : movies.length === 0 ? (
              <div className="text-gray-400">No results found</div>
            ) : (
              movies.slice(0, 10).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => onMovieSelect(movie)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedMovie?.id === movie.id
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  <div className="font-medium">{movie.title}</div>
                  <div className="text-sm opacity-75">
                    {theme === 'year' ? `${movie.year} • ${movie.genre}` : movie.genre}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MovieSearch;
