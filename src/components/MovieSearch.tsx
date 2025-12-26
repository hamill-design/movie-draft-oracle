import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { INPUT_LIMITS } from '@/utils/inputValidation';
import { SearchIcon } from '@/components/icons/SearchIcon';

interface MovieSearchProps {
  theme: string;
  option: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  movies: Movie[];
  loading: boolean;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
  themeParameter: string;
}

const MovieSearch = ({
  theme,
  option,
  searchQuery,
  onSearchChange,
  movies,
  loading,
  selectedMovie,
  onMovieSelect,
  themeParameter
}: MovieSearchProps) => {
  console.log('MovieSearch - Props received:', {
    theme,
    option,
    movies: movies.length,
    loading,
    searchQuery,
    themeParameter
  });

  const getPlaceholderText = () => {
    if (theme === 'spec-draft') {
      return `Search movies...`;
    } else if (theme === 'year') {
      return `Search within ${option} movies...`;
    } else if (theme === 'people') {
      return `Search within ${getCleanActorName(option)} movies...`;
    } else {
      return `Search for movies...`;
    }
  };

  // Backend handles all filtering for year/person themes - use results directly
  let filteredMoviesByTheme = movies;
  // For spec-draft, movies are already filtered by spec_draft_id in useMovies, so no additional filtering needed

  // For year/person, backend already filtered by search query and year - use results directly
  // For other themes, apply client-side filtering
  const filteredMovies = (theme === 'year' || theme === 'people')
    ? filteredMoviesByTheme // Use backend results directly - no additional filtering needed
    : searchQuery.trim() 
      ? filteredMoviesByTheme.filter(movie => 
          movie.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
        )
      : filteredMoviesByTheme;

  console.log('MovieSearch - Final filtered movies:', filteredMovies.length, 'from theme-filtered:', filteredMoviesByTheme.length, 'from total:', movies.length);

  // Show results when user has typed at least 2 characters (for year/person) or any characters (for others)
  const shouldShowResults = theme === 'year' || theme === 'people' 
    ? searchQuery.trim().length >= 2 
    : searchQuery.trim().length > 0;

  const getTitleText = () => {
    if (theme === 'spec-draft') {
      return 'Search Movies';
    } else if (theme === 'year') {
      return `Search Movies from ${option}`;
    } else if (theme === 'people') {
      return `Search Movies featuring ${getCleanActorName(option)}`;
    } else {
      return 'Search Movies';
    }
  };

  const getGenreText = (movie: Movie) => {
    if (movie.genre) {
      return `${movie.year} • ${movie.genre}`;
    }
    return `${movie.year}`;
  };

  return (
    <div 
      className="w-full h-full rounded-lg flex flex-col"
      style={{
        padding: '24px',
        background: '#0E0E0F',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px',
        gap: '24px'
      }}
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '8px',
          display: 'inline-flex'
        }}
      >
        <div 
          style={{
            width: '24px',
            height: '24px',
            padding: '2px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            display: 'inline-flex',
            flexShrink: 0,
            alignSelf: 'center'
          }}
        >
          <div 
            style={{ 
              width: '20px', 
              height: '20px', 
              color: '#907AFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0
            }}
          >
            <SearchIcon className="w-full h-full" />
          </div>
        </div>
        <div 
          style={{
            flex: '1 1 0',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: '#FCFFFF',
            fontSize: '20px',
            fontFamily: 'Brockmann',
            fontWeight: 500,
            lineHeight: '28px',
            alignSelf: 'center'
          }}
        >
          {getTitleText()}
        </div>
      </div>
      
      <div 
        className="flex flex-col"
        style={{
          alignSelf: 'stretch',
          gap: '16px'
        }}
      >
        <div className="flex flex-col">
          <div 
            className="flex items-center"
            style={{
              alignSelf: 'stretch',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              background: '#1D1D1F',
              borderRadius: '2px',
              outline: '1px #FCFFFF solid',
              outlineOffset: '-1px',
              gap: '12px',
              overflow: 'hidden'
            }}
          >
            <div className="flex-1 overflow-hidden flex flex-col justify-start items-start">
              <input
                placeholder={getPlaceholderText()}
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH) {
                    onSearchChange(value);
                  }
                }}
                maxLength={INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#FCFFFF',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: 500,
                  lineHeight: '20px',
                  outline: 'none',
                  border: 'none'
                }}
                className="placeholder:opacity-60"
              />
            </div>
          </div>
        </div>
        
        {shouldShowResults && (
          <div 
            className="flex flex-col justify-start items-center"
            style={{
              alignSelf: 'stretch',
              maxHeight: '240px',
              overflowY: 'auto',
              overflowX: 'hidden',
              gap: '8px'
            }}
          >
            {loading ? (
              <div 
                style={{
                  color: '#FCFFFF',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                Loading movies...
              </div>
            ) : !shouldShowResults && (theme === 'year' || theme === 'people') ? (
              <div 
                style={{
                  color: '#FCFFFF',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                Type at least 2 characters to search for movies {theme === 'year' ? `from ${option}` : `featuring ${getCleanActorName(option)}`}
              </div>
            ) : filteredMoviesByTheme.length === 0 ? (
              <div 
                style={{
                  color: '#FCFFFF',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                No movies available {theme === 'spec-draft' ? 'for this draft' : theme === 'year' ? `for ${option}` : theme === 'people' ? `for ${getCleanActorName(option)}` : 'for this search'}
              </div>
            ) : filteredMovies.length === 0 ? (
              <div 
                style={{
                  color: '#FCFFFF',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                No movies found matching "{searchQuery}" {theme === 'spec-draft' ? '' : theme === 'year' ? `from ${option}` : theme === 'people' ? `featuring ${getCleanActorName(option)}` : ''}
              </div>
            ) : (
              filteredMovies.slice(0, 50).map((movie) => {
                const isSelected = selectedMovie?.id === movie.id;
                return (
                  <div
                    key={movie.id}
                    onClick={() => onMovieSelect(movie)}
                    style={{
                      width: '100%',
                      height: '100%',
                      paddingTop: '10px',
                      paddingBottom: '12px',
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      background: isSelected ? '#7142FF' : '#1D1D1F',
                      borderRadius: '4px',
                      outline: isSelected ? 'none' : '1px #666469 solid',
                      outlineOffset: '-1px',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: '2px',
                      display: 'inline-flex',
                      cursor: 'pointer'
                    }}
                  >
                    <div 
                      style={{ 
                        alignSelf: 'stretch',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        display: 'flex'
                      }}
                    >
                      <div 
                        style={{
                          alignSelf: 'stretch',
                          justifyContent: 'flex-start',
                          display: 'flex',
                          flexDirection: 'column',
                          color: '#FCFFFF',
                          fontSize: '16px',
                          fontFamily: 'Brockmann',
                          fontWeight: 600,
                          lineHeight: '24px',
                          letterSpacing: '0.32px',
                          textAlign: 'left'
                        }}
                      >
                        {movie.title}
                      </div>
                    </div>
                    <div 
                      style={{ 
                        alignSelf: 'stretch',
                        opacity: 0.75,
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        display: 'flex'
                      }}
                    >
                      <div 
                        style={{
                          alignSelf: 'stretch',
                          justifyContent: 'flex-start',
                          display: 'flex',
                          flexDirection: 'column',
                          color: '#FCFFFF',
                          fontSize: '14px',
                          fontFamily: 'Brockmann',
                          fontWeight: 400,
                          lineHeight: '20px',
                          textAlign: 'left'
                        }}
                      >
                        {getGenreText(movie)}
                        {theme === 'year' && movie.year !== parseInt(option) && (
                          <span style={{ color: '#ef4444', marginLeft: '8px' }}>[YEAR MISMATCH: {movie.year}]</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {filteredMovies.length > 50 && (
              <div 
                className="text-center"
                style={{
                  color: '#FCFFFF',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: 400,
                  lineHeight: '20px',
                  paddingTop: '8px',
                  paddingBottom: '8px'
                }}
              >
                Showing first 50 results of {filteredMovies.length} movies. Use search to narrow down.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieSearch;
