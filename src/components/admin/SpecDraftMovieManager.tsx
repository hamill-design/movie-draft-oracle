import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, Loader2, CheckCircle2, Film, CheckSquare2, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SpecDraftWithMovies, SpecDraftMovie } from '@/hooks/useSpecDraftsAdmin';
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

// CustomCheckbox Component (reused from EnhancedCategoriesForm)
const CustomCheckbox = ({ 
  category, 
  isChecked, 
  onToggle
}: { 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void; 
}) => {
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div 
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '8px',
        display: 'inline-flex',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggle(!isChecked)}
      title={category}
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
    </div>
  );
};

export const SpecDraftMovieManager: React.FC<SpecDraftMovieManagerProps> = ({
  specDraft,
  onMovieAdded,
  onMovieRemoved,
  onCategoriesUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedMovieForCategories, setSelectedMovieForCategories] = useState<(SpecDraftMovie & { categories: Array<{ id: string; spec_draft_movie_id: string; category_name: string; is_automated: boolean }> }) | null>(null);
  const [categoryCheckboxes, setCategoryCheckboxes] = useState<Record<string, boolean>>({});
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const [movieFilterQuery, setMovieFilterQuery] = useState('');
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
        .from('spec_draft_movies' as any)
        .insert({
          spec_draft_id: specDraft.id,
          movie_tmdb_id: movie.id,
          movie_title: movie.title,
          movie_year: movie.year ?? null,
          movie_poster_path: movie.posterPath ?? null,
          movie_genres: movie.genres || [],
          oscar_status: movie.oscarStatus ?? null,
          revenue: movie.revenue ?? null,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Add auto-detected categories
      if (autoCategories.length > 0 && movieData && 'id' in movieData) {
        const categoriesToInsert = autoCategories.map(categoryName => ({
          spec_draft_movie_id: (movieData as any).id,
          category_name: categoryName,
          is_automated: true,
        }));

        const { error: categoriesError } = await supabase
          .from('spec_draft_movie_categories' as any)
          .insert(categoriesToInsert as any);

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
        .from('spec_draft_movies' as any)
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

  const handleManageCategories = (movie: SpecDraftMovie & { categories: Array<{ id: string; spec_draft_movie_id: string; category_name: string; is_automated: boolean }> }) => {
    setSelectedMovieForCategories(movie);
    // Initialize checkboxes with current categories
    const currentCategories = movie.categories.map((c: { id: string; spec_draft_movie_id: string; category_name: string; is_automated: boolean }) => c.category_name);
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

      // Get current automated categories (unused but kept for potential future use)
      // const currentAutoCategories = selectedMovieForCategories.categories
      //   .filter((c: { id: string; spec_draft_movie_id: string; category_name: string; is_automated: boolean }) => c.is_automated)
      //   .map((c: { id: string; spec_draft_movie_id: string; category_name: string; is_automated: boolean }) => c.category_name);

      // Determine which categories are automated (those that match auto-detection)
      const movie = specDraft.movies.find(m => m.id === selectedMovieForCategories.id);
      if (movie) {
        // Convert oscar_status to hasOscar boolean for compatibility
        const hasOscar = movie.oscar_status === 'winner' || movie.oscar_status === 'nominee';
        const isBlockbuster = !!(movie.revenue && movie.revenue >= 50000000);
        
        // Convert genre IDs to genre string (same as fetch-movies does)
        const genreString = movie.movie_genres && movie.movie_genres.length > 0
          ? movie.movie_genres.map((id: number) => getGenreName(id)).join(' ')
          : '';
        
        const autoCategories = mapGenresToCategories(
          genreString || movie.movie_genres || [],
          movie.movie_year,
          movie.oscar_status,
          movie.revenue,
          hasOscar ? true : undefined,
          isBlockbuster ? true : undefined
        );

        // Update categories
        const { error: deleteError } = await supabase
          .from('spec_draft_movie_categories' as any)
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
            .from('spec_draft_movie_categories' as any)
            .insert(categoriesToInsert as any);

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
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
        {/* Header */}
        <div className="flex gap-2 items-center">
          <Film className="w-6 h-6 text-brand-primary" />
          <h3
            className="text-xl text-text-primary"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px' }}
          >
            Add Movies
          </h3>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-greyscale-blue-400 pointer-events-none z-10" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowResults(true);
            }}
            placeholder="Search for movies"
            className="pl-14 h-12 pr-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
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
              <X className="w-4 h-4 text-greyscale-blue-400" />
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

      {/* Movies List */}
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex gap-2 items-center">
            <CheckSquare2 className="w-6 h-6 text-brand-primary" />
            <h3
              className="text-xl text-text-primary"
              style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px' }}
            >
              Eligible Movies ({movieFilterQuery.trim() 
                ? specDraft.movies.filter((movie) => {
                    const query = movieFilterQuery.toLowerCase();
                    const matchesTitle = movie.movie_title?.toLowerCase().includes(query);
                    const matchesYear = movie.movie_year?.toString().includes(query);
                    const matchesCategories = movie.categories?.some(cat => 
                      cat.category_name.toLowerCase().includes(query)
                    );
                    return matchesTitle || matchesYear || matchesCategories;
                  }).length
                : specDraft.movies.length})
            </h3>
          </div>
          <div className="flex-1 min-w-0 sm:min-w-[294px] sm:max-w-[480px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-greyscale-blue-400 pointer-events-none z-10" />
              <Input
                placeholder="Search for movies"
                value={movieFilterQuery}
                onChange={(e) => setMovieFilterQuery(e.target.value)}
                className="pl-11 h-8 pr-2 py-1.5 border-greyscale-blue-400 rounded-[2px] text-xs"
                style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
              />
              {movieFilterQuery && (
                <button
                  type="button"
                  onClick={() => setMovieFilterQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-3 h-3 text-greyscale-blue-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Movies List */}
        {specDraft.movies.length === 0 ? (
          <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-6 text-center">
            <p
              className="text-greyscale-blue-600"
              style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
            >
              No movies added yet. Search and add movies above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {specDraft.movies
              .filter((movie) => {
                if (!movieFilterQuery.trim()) return true;
                const query = movieFilterQuery.toLowerCase();
                const matchesTitle = movie.movie_title?.toLowerCase().includes(query);
                const matchesYear = movie.movie_year?.toString().includes(query);
                const matchesCategories = movie.categories?.some(cat => 
                  cat.category_name.toLowerCase().includes(query)
                );
                return matchesTitle || matchesYear || matchesCategories;
              })
              .map((movie) => {
              const posterUrl = getPosterUrl(movie.movie_poster_path);
              const isManaging = selectedMovieForCategories?.id === movie.id;

              return (
                <div
                  key={movie.id}
                  className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-4 flex flex-col gap-4"
                >
                  {/* Movie Info Row - Always horizontal, buttons stay in place */}
                  <div className="flex gap-4 items-start">
                    {/* Poster */}
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={movie.movie_title}
                        className="w-[69.33px] h-[104px] object-cover rounded-[4px] shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-[69.33px] h-[104px] bg-greyscale-blue-200 rounded-[4px] flex items-center justify-center shrink-0">
                        <Film className="w-6 h-6 text-greyscale-blue-400" />
                      </div>
                    )}

                    {/* Movie Details */}
                    <div className="flex flex-col gap-4 flex-1 min-w-0">
                      {/* Title, Year, Actions */}
                      <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                          <h4
                            className="text-base text-[#2b2f31] truncate"
                            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
                          >
                            {movie.movie_title}
                          </h4>
                          {movie.movie_year && (
                            <p
                              className="text-sm text-gray-500"
                              style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
                            >
                              {movie.movie_year}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-auto">
                          <button
                            onClick={() => handleManageCategories(movie)}
                            className="p-2 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors shrink-0"
                            title="Edit Categories"
                          >
                            <Edit2 className="w-4 h-4 text-text-primary" />
                          </button>
                          <button
                            onClick={() => handleRemoveMovie(movie.id)}
                            className="p-2 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors shrink-0"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-text-primary" />
                          </button>
                        </div>
                      </div>

                      {/* Categories Display */}
                      <div className="flex flex-col gap-2">
                        <Label
                          className="text-sm text-greyscale-blue-700"
                          style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px', lineHeight: '20px' }}
                        >
                          Categories
                        </Label>
                        {movie.categories.length === 0 ? (
                          <p
                            className="text-xs text-gray-400"
                            style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                          >
                            No categories assigned
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-4">
                            {movie.categories.map((cat) => (
                              <span
                                key={cat.id}
                                className="text-xs text-purple-800"
                                style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '12px', lineHeight: '16px' }}
                              >
                                {cat.category_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Category Management Section */}
                  {isManaging && (
                    <div className="border-t border-greyscale-blue-300 pt-4 mt-4 w-full">
                      <div className="space-y-4">
                        {/* Standard Categories Grid */}
                        <div 
                          style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '20px',
                            alignItems: 'start'
                          }}
                        >
                          {standardCategories.map((category) => {
                            const isChecked = categoryCheckboxes[category] || false;

                              return (
                                <CustomCheckbox
                                  key={category}
                                  category={category}
                                  isChecked={isChecked}
                                  onToggle={(checked) => {
                                    setCategoryCheckboxes(prev => ({
                                      ...prev,
                                      [category]: checked,
                                    }));
                                  }}
                              />
                            );
                          })}
                        </div>

                        {/* Custom Categories Section */}
                        {customCategoryNames.length > 0 && (
                          <div className="border-t border-greyscale-blue-300 pt-3 mt-2">
                            <div
                              className="text-xs text-greyscale-blue-600 mb-3"
                              style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '12px', lineHeight: '16px' }}
                            >
                              Custom Categories
                            </div>
                            <div 
                              style={{
                                width: '100%',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '20px',
                                alignItems: 'start'
                              }}
                            >
                              {customCategoryNames.map((category, index) => {
                                const isChecked = categoryCheckboxes[category] || false;
                                const customCategory = customCategories.find(c => c.category_name === category);

                                return (
                                  <CustomCheckbox
                                    key={`custom-${category}-${customCategory?.id || index}`}
                                    category={category}
                                    isChecked={isChecked}
                                    onToggle={(checked) => {
                                      setCategoryCheckboxes(prev => ({
                                        ...prev,
                                        [category]: checked,
                                      }));
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setSelectedMovieForCategories(null)}
                            disabled={updatingCategories}
                            className="h-12 px-6 py-3 border-greyscale-blue-200 rounded-[2px] bg-ui-primary"
                            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleUpdateCategories}
                            disabled={updatingCategories}
                            className="h-12 px-6 py-3 bg-brand-primary text-ui-primary hover:bg-brand-primary/90 rounded-[2px]"
                            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
                          >
                            {updatingCategories ? 'Updating...' : 'Update Category'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

