import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SpecDraftWithMovies, SpecDraftMovie, SpecDraftMovieCategory } from '@/hooks/useSpecDraftsAdmin';
import { mapGenresToCategories, getGenreName } from '@/utils/specDraftGenreMapper';
import { useToast } from '@/hooks/use-toast';

interface SpecDraftMovieManagerProps {
  specDraft: SpecDraftWithMovies;
  onMovieAdded: () => void;
  onMovieRemoved: () => void;
  onCategoriesUpdated: () => void;
  loading?: boolean;
}

interface MovieSearchResult {
  id: number;
  title: string;
  year: number;
  posterPath?: string;
  genre?: string; // Genre string from fetch-movies (e.g., "Action Adventure Comedy")
  genres?: number[]; // Genre IDs array for storage
  releaseDate?: string;
  oscarStatus?: string;
  hasOscar?: boolean;
  revenue?: number;
  isBlockbuster?: boolean;
}

export const SpecDraftMovieManager: React.FC<SpecDraftMovieManagerProps> = ({
  specDraft,
  onMovieAdded,
  onMovieRemoved,
  onCategoriesUpdated,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedMovieForCategories, setSelectedMovieForCategories] = useState<SpecDraftMovie | null>(null);
  const [categoryCheckboxes, setCategoryCheckboxes] = useState<Record<string, boolean>>({});
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Standard categories
  const standardCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    "30's",
    "40's",
    "50's",
    "60's",
    "70's",
    "80's",
    "90's",
    "2000's",
    "2010's",
    "2020's",
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)',
  ];

  // Custom categories from the spec draft
  const customCategories = specDraft.customCategories || [];
  const customCategoryNames = customCategories.map(cat => cat.category_name);

  // Debug: Log when custom categories change
  React.useEffect(() => {
    console.log('🎬 SpecDraftMovieManager: Custom categories updated', {
      count: customCategoryNames.length,
      names: customCategoryNames,
      fullData: customCategories
    });
  }, [customCategoryNames.length, customCategories.length]);

  // All categories = standard + custom
  const allCategories = [...standardCategories, ...customCategoryNames];

  // Search for movies
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-movies', {
          body: {
            category: 'search',
            searchQuery: searchQuery.trim(),
            fetchAll: false,
            page: 1,
          },
        });

        if (error) throw error;

        const movies = (data?.results || []).map((movie: any) => {
          // Extract genres - fetch-movies returns 'genre' as a string (e.g., "Action Adventure Comedy")
          // Also try to get genre_ids as fallback
          let genreString: string = movie.genre || '';
          let genreIds: number[] = [];
          
          // If we have genre_ids, extract them (for storing in database)
          if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
            genreIds = movie.genre_ids;
          } else if (movie.genres && Array.isArray(movie.genres)) {
            genreIds = movie.genres.map((g: any) => typeof g === 'object' ? (g.id || g) : g);
          }

          return {
            id: movie.id || movie.tmdbId,
            title: movie.title,
            year: movie.year || (movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null),
            posterPath: movie.posterPath || movie.poster_path,
            genre: genreString, // String format for category detection
            genres: genreIds, // Array of IDs for storage
            releaseDate: movie.release_date,
            oscarStatus: movie.oscar_status || movie.oscarStatus || null,
            hasOscar: movie.hasOscar || (movie.oscar_status === 'winner' || movie.oscar_status === 'nominee'),
            revenue: movie.revenue || null,
            isBlockbuster: movie.isBlockbuster || (movie.revenue && movie.revenue >= 50000000),
          };
        });

        setSearchResults(movies);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
        toast({
          title: 'Error',
          description: 'Failed to search movies',
          variant: 'destructive',
        });
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, toast]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddMovie = async (movie: MovieSearchResult) => {
    try {
      // Check if movie already exists in spec draft
      const existingMovie = specDraft.movies.find(m => m.movie_tmdb_id === movie.id);
      if (existingMovie) {
        toast({
          title: 'Movie already added',
          description: `"${movie.title}" is already in this spec draft`,
          variant: 'default',
        });
        return;
      }

      // Use the data from search results, which should already include all needed fields
      // The fetch-movies function processes all this data, so we should have it
      // Automatically determine categories using the same logic as the draft system
      // Use genre string (preferred) or fallback to genre IDs array
      const genreData = movie.genre || movie.genres || [];
      const autoCategories = mapGenresToCategories(
        genreData,
        movie.year,
        movie.oscarStatus,
        movie.revenue,
        movie.hasOscar,
        movie.isBlockbuster
      );

      // Add movie to spec draft with all available data
      const { data: movieData, error: insertError } = await supabase
        .from('spec_draft_movies')
        .insert({
          spec_draft_id: specDraft.id,
          movie_tmdb_id: movie.id,
          movie_title: movie.title,
          movie_year: movie.year,
          movie_poster_path: movie.posterPath,
          movie_genres: movie.genres || [],
          oscar_status: movie.oscarStatus || null,
          revenue: movie.revenue || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add auto-detected categories
      if (autoCategories.length > 0 && movieData) {
        const categoriesToInsert = autoCategories.map(categoryName => ({
          spec_draft_movie_id: movieData.id,
          category_name: categoryName,
          is_automated: true,
        }));

        const { error: categoriesError } = await supabase
          .from('spec_draft_movie_categories')
          .insert(categoriesToInsert);

        if (categoriesError) {
          console.error('Error adding auto-categories:', categoriesError);
        }
      }

      toast({
        title: 'Success',
        description: `"${movie.title}" added with ${autoCategories.length} auto-detected categories`,
      });

      setSearchQuery('');
      setShowResults(false);
      onMovieAdded();
    } catch (err) {
      console.error('Error adding movie:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add movie',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMovie = async (movieId: string) => {
    if (!confirm('Are you sure you want to remove this movie from the spec draft?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('spec_draft_movies')
        .delete()
        .eq('id', movieId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Movie removed from spec draft',
      });

      onMovieRemoved();
    } catch (err) {
      console.error('Error removing movie:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove movie',
        variant: 'destructive',
      });
    }
  };

  const handleManageCategories = (movie: SpecDraftMovie) => {
    setSelectedMovieForCategories(movie);
    // Initialize checkboxes with current categories
    const currentCategories = movie.categories.map(c => c.category_name);
    const checkboxes: Record<string, boolean> = {};
    allCategories.forEach(cat => {
      checkboxes[cat] = currentCategories.includes(cat);
    });
    setCategoryCheckboxes(checkboxes);
  };

  const handleUpdateCategories = async () => {
    if (!selectedMovieForCategories) return;

    setUpdatingCategories(true);
    try {
      const selectedCategories = Object.entries(categoryCheckboxes)
        .filter(([_, checked]) => checked)
        .map(([categoryName]) => categoryName);

      // Get current automated categories
      const currentAutoCategories = selectedMovieForCategories.categories
        .filter(c => c.is_automated)
        .map(c => c.category_name);

      // Determine which categories are automated (those that match auto-detection)
      const movie = specDraft.movies.find(m => m.id === selectedMovieForCategories.id);
      if (movie) {
        // Convert oscar_status to hasOscar boolean for compatibility
        const hasOscar = movie.oscar_status === 'winner' || movie.oscar_status === 'nominee';
        const isBlockbuster = movie.revenue && movie.revenue >= 50000000;
        
        // Convert genre IDs to genre string (same as fetch-movies does)
        const genreString = movie.movie_genres && movie.movie_genres.length > 0
          ? movie.movie_genres.map((id: number) => getGenreName(id)).join(' ')
          : '';
        
        const autoCategories = mapGenresToCategories(
          genreString || movie.movie_genres || [],
          movie.movie_year,
          movie.oscar_status,
          movie.revenue,
          hasOscar,
          isBlockbuster
        );

        // Update categories
        const { error: deleteError } = await supabase
          .from('spec_draft_movie_categories')
          .delete()
          .eq('spec_draft_movie_id', selectedMovieForCategories.id);

        if (deleteError) throw deleteError;

        if (selectedCategories.length > 0) {
          const categoriesToInsert = selectedCategories.map(categoryName => ({
            spec_draft_movie_id: selectedMovieForCategories.id,
            category_name: categoryName,
            // Custom categories are never automated, only standard categories can be auto-detected
            is_automated: customCategoryNames.includes(categoryName) ? false : autoCategories.includes(categoryName),
          }));

          const { error: insertError } = await supabase
            .from('spec_draft_movie_categories')
            .insert(categoriesToInsert);

          if (insertError) throw insertError;
        }

        toast({
          title: 'Success',
          description: 'Categories updated',
        });

        setSelectedMovieForCategories(null);
        onCategoriesUpdated();
      }
    } catch (err) {
      console.error('Error updating categories:', err);
      toast({
        title: 'Error',
        description: 'Failed to update categories',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCategories(false);
    }
  };

  const getPosterUrl = (posterPath: string | null | undefined) => {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  return (
    <div className="space-y-6">
      {/* Search and Add Movies */}
      <Card>
        <CardHeader>
          <CardTitle>Add Movies to Spec Draft</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResults(true);
                }}
                placeholder="Search for movies..."
                className="pl-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}

              {/* Search Results */}
              {showResults && (searchLoading || searchResults.length > 0) && (
                <div
                  ref={resultsRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-auto"
                >
                  {searchLoading && (
                    <div className="p-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                    </div>
                  )}
                  {!searchLoading && searchResults.map((movie) => {
                    const isAdded = specDraft.movies.some(m => m.movie_tmdb_id === movie.id);
                    const posterUrl = getPosterUrl(movie.posterPath);

                    return (
                      <button
                        key={movie.id}
                        type="button"
                        onClick={() => !isAdded && handleAddMovie(movie)}
                        disabled={isAdded}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 ${
                          isAdded ? 'bg-green-50 opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        {posterUrl && (
                          <img
                            src={posterUrl}
                            alt={movie.title}
                            className="w-12 h-16 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{movie.title}</div>
                          <div className="text-xs text-gray-500">{movie.year}</div>
                          {movie.genres && movie.genres.length > 0 && (
                            <div className="text-xs text-gray-400">
                              {movie.genres.map(id => getGenreName(id)).join(', ')}
                            </div>
                          )}
                        </div>
                        {isAdded && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movies List */}
      <Card>
        <CardHeader>
          <CardTitle>Movies in Spec Draft ({specDraft.movies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {specDraft.movies.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No movies added yet. Search and add movies above.</p>
          ) : (
            <div className="space-y-4">
              {specDraft.movies.map((movie) => {
                const posterUrl = getPosterUrl(movie.movie_poster_path);
                const automatedCategories = movie.categories.filter(c => c.is_automated);
                const manualCategories = movie.categories.filter(c => !c.is_automated);

                return (
                  <div
                    key={movie.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    {posterUrl && (
                      <img
                        src={posterUrl}
                        alt={movie.movie_title}
                        className="w-16 h-24 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{movie.movie_title}</h3>
                          {movie.movie_year && (
                            <p className="text-sm text-gray-500">{movie.movie_year}</p>
                          )}
                          {movie.movie_genres && movie.movie_genres.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {movie.movie_genres.map(id => getGenreName(id)).join(', ')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMovie(movie.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Categories */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-sm font-medium">Categories:</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManageCategories(movie)}
                          >
                            Manage
                          </Button>
                        </div>
                        {movie.categories.length === 0 ? (
                          <p className="text-xs text-gray-400">No categories assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {movie.categories.map((cat) => (
                              <Badge key={cat.id} variant={cat.is_automated ? "secondary" : "outline"} className="text-xs">
                                {cat.category_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Management Dialog */}
      {selectedMovieForCategories && (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Manage Categories for "{selectedMovieForCategories.movie_title}"</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select which categories this movie can apply to.
              </p>
              <div className="text-xs text-gray-500 mb-2">
                Total categories: {allCategories.length} (Standard: {standardCategories.length}, Custom: {customCategoryNames.length})
              </div>
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                {/* Standard Categories */}
                {standardCategories.map((category) => {
                  const isChecked = categoryCheckboxes[category] || false;
                  const movie = specDraft.movies.find(m => m.id === selectedMovieForCategories.id);
                  const genreString = movie && movie.movie_genres && movie.movie_genres.length > 0
                    ? movie.movie_genres.map((id: number) => getGenreName(id)).join(' ')
                    : '';
                  const hasOscar = movie && (movie.oscar_status === 'winner' || movie.oscar_status === 'nominee');
                  const isBlockbuster = movie && movie.revenue && movie.revenue >= 50000000;
                  
                  const isAutoDetected = movie && mapGenresToCategories(
                    genreString || movie.movie_genres || [],
                    movie.movie_year,
                    movie.oscar_status,
                    movie.revenue,
                    hasOscar,
                    isBlockbuster
                  ).includes(category);

                  return (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setCategoryCheckboxes(prev => ({
                            ...prev,
                            [category]: checked === true,
                          }));
                        }}
                      />
                      <Label
                        htmlFor={`category-${category}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {category}
                        {isAutoDetected && (
                          <span className="ml-1 text-xs text-gray-500">(auto)</span>
                        )}
                      </Label>
                    </div>
                  );
                })}
                
                {/* Custom Categories */}
                {customCategoryNames.length > 0 && (
                  <>
                    <div className="col-span-2 border-t pt-3 mt-2">
                      <div className="text-xs font-semibold text-gray-500 mb-2">
                        Custom Categories ({customCategoryNames.length})
                      </div>
                    </div>
                    {customCategoryNames.map((category, index) => {
                      const isChecked = categoryCheckboxes[category] || false;
                      const customCategory = customCategories.find(c => c.category_name === category);

                      // Debug: Log each category being rendered
                      if (index === 0) {
                        console.log('🎬 Rendering custom categories in dialog:', customCategoryNames);
                      }

                      return (
                        <div 
                          key={`custom-${category}-${customCategory?.id || index}`} 
                          className="flex items-center space-x-2"
                          data-category-name={category}
                        >
                          <Checkbox
                            id={`category-custom-${category}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setCategoryCheckboxes(prev => ({
                                ...prev,
                                [category]: checked === true,
                              }));
                            }}
                          />
                          <Label
                            htmlFor={`category-custom-${category}`}
                            className="text-sm font-normal cursor-pointer"
                            title={customCategory?.description || undefined}
                          >
                            {category}
                            <span className="ml-1 text-xs text-gray-400">(custom)</span>
                          </Label>
                        </div>
                      );
                    })}
                  </>
                )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMovieForCategories(null)}
                  disabled={updatingCategories}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateCategories}
                  disabled={updatingCategories}
                >
                  {updatingCategories ? 'Updating...' : 'Update Categories'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

