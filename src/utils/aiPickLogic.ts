import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { getGenreName } from '@/utils/specDraftGenreMapper';

export interface AIPickOptions {
  draftTheme: string;
  draftOption: string;
  currentCategory: string;
  alreadyPickedMovieIds: number[];
  searchQuery?: string;
}

/**
 * Make an AI pick using an improved quality scoring system that considers
 * multiple factors beyond just popularity to improve competitiveness
 */
export async function makeAIPick(options: AIPickOptions): Promise<Movie | null> {
  try {
    const { draftTheme, draftOption, currentCategory, alreadyPickedMovieIds, searchQuery } = options;

    let movies: Movie[] = [];

    // Handle spec-draft theme - fetch movies from spec_draft_movies, filtered by current category.
    // Use draftTheme (not currentCategory) to detect spec drafts; then filter by currentCategory
    // so the AI only picks movies eligible for this round (via spec_draft_movie_categories).
    if (draftTheme === 'spec-draft' && draftOption) {
      const { data: moviesData, error: moviesError } = await (supabase as any)
        .from('spec_draft_movies')
        .select('id, movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres')
        .eq('spec_draft_id', draftOption)
        .order('movie_title', { ascending: true });

      if (moviesError) {
        console.error('Error fetching spec draft movies for AI:', moviesError);
        throw moviesError;
      }

      let pool = moviesData || [];
      // When the draft has custom categories, only allow movies eligible for this round's category
      if (currentCategory && currentCategory.trim() !== '') {
        const { data: categoryData, error: categoryError } = await (supabase as any)
          .from('spec_draft_movie_categories')
          .select('spec_draft_movie_id')
          .eq('category_name', currentCategory.trim());

        if (!categoryError && categoryData && categoryData.length > 0) {
          const eligibleIds = new Set(categoryData.map((r: { spec_draft_movie_id: string }) => r.spec_draft_movie_id));
          pool = pool.filter((m: { id: string }) => eligibleIds.has(m.id));
        }
      }

      // Transform spec draft movies to Movie format
      movies = pool.map((movie: any) => {
        let genreString = '';
        if (movie.movie_genres && Array.isArray(movie.movie_genres) && movie.movie_genres.length > 0) {
          const genreNames = movie.movie_genres
            .map((id: number) => getGenreName(id))
            .filter(Boolean);
          genreString = genreNames.join(' ');
        }

        return {
          id: movie.movie_tmdb_id,
          title: movie.movie_title,
          year: movie.movie_year,
          poster_path: movie.movie_poster_path,
          genre: genreString,
          overview: '',
          rating: 0,
          vote_count: 0
        };
      });
    } else {
      // For other themes, use fetch-movies Edge Function
      // Note: fetch-movies expects theme types ('year', 'person', 'all'), not category names
      let cleanedThemeOption = draftOption || '';
      if (draftTheme === 'person' && draftOption) {
        cleanedThemeOption = getCleanActorName(draftOption);
      }

      // Map draftTheme to the category parameter expected by fetch-movies
      // draftTheme can be 'year', 'person', or 'people' (which maps to 'person')
      const themeCategory = draftTheme === 'people' ? 'person' : draftTheme === 'year' ? 'year' : 'all';

      const requestBody = draftTheme === 'year' 
        ? {
            category: themeCategory, // Use theme type, not category name
            searchQuery: cleanedThemeOption,
            movieSearchQuery: searchQuery || '',
            fetchAll: false,
            page: 1,
            pageLimit: 50 // Get more results for AI to choose from
          }
        : draftTheme === 'person' || draftTheme === 'people'
        ? {
            category: 'person', // Use theme type, not category name
            searchQuery: cleanedThemeOption,
            movieSearchQuery: searchQuery || '',
            fetchAll: false,
            page: 1,
            pageLimit: 50
          }
        : {
            category: 'all', // Use theme type, not category name
            searchQuery: cleanedThemeOption,
            fetchAll: true
          };

      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      if (error) {
        console.error('Error fetching movies for AI:', error);
        throw error;
      }

      // fetch-movies returns results in data.results, not data.movies
      if (data?.results && Array.isArray(data.results)) {
        movies = data.results;
      } else if (data?.movies && Array.isArray(data.movies)) {
        // Fallback for backwards compatibility
        movies = data.movies;
      }
    }

    // Filter out already picked movies
    const availableMovies = movies.filter(movie => !alreadyPickedMovieIds.includes(movie.id));

    if (availableMovies.length === 0) {
      console.warn('No available movies for AI to pick from');
      return null;
    }

    // Calculate a quality score for each movie to improve AI competitiveness
    // This considers multiple factors beyond just popularity
    const calculateQualityScore = (movie: any): number => {
      let score = 0;
      
      // 1. Vote Average (TMDB rating) - weighted heavily but requires sufficient votes
      // Only trust ratings with at least 100 votes to avoid obscure movies
      const voteAverage = movie.voteAverage || 0;
      const voteCount = (movie as any).vote_count || 0; // May not be in Movie interface but exists in response
      
      if (voteAverage > 0 && voteCount >= 100) {
        // Scale 0-10 rating to 0-100 points, with bonus for very high ratings
        score += voteAverage * 10;
        // Bonus for movies with many votes (indicates popularity/quality)
        if (voteCount >= 1000) score += 5;
        if (voteCount >= 5000) score += 5;
      } else if (voteAverage > 0) {
        // Lower weight for movies with fewer votes
        score += voteAverage * 5;
      }
      
      // 2. Oscar Status - significant quality indicator
      const oscarStatus = (movie as any).oscar_status || ((movie as any).hasOscar ? 'nominee' : null);
      if (oscarStatus === 'winner') {
        score += 20; // Oscar winners are strong picks
      } else if (oscarStatus === 'nominee') {
        score += 10; // Nominees are also strong
      }
      
      // 3. Blockbuster Status - indicates high production value
      const isBlockbuster = (movie as any).isBlockbuster || false;
      if (isBlockbuster) {
        score += 5;
      }
      
      // 4. Budget/Revenue - high budget often correlates with quality
      const budget = (movie as any).budget || 0;
      const revenue = (movie as any).revenue || 0;
      if (budget >= 50000000) score += 3; // High budget
      if (revenue >= 100000000) score += 2; // High revenue
      
      // 5. Slight preference for older classics (to balance recency bias)
      // Movies from 1990-2010 get a small bonus (golden era of cinema)
      const year = movie.year || 0;
      if (year >= 1990 && year <= 2010) {
        score += 2;
      }
      
      return score;
    };

    // Sort by quality score (highest first)
    const sortedMovies = availableMovies.sort((a, b) => {
      const scoreA = calculateQualityScore(a);
      const scoreB = calculateQualityScore(b);
      
      // Primary sort: quality score
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // Secondary sort: vote average (if scores are equal)
      const voteA = a.voteAverage || 0;
      const voteB = b.voteAverage || 0;
      if (voteB !== voteA) {
        return voteB - voteA;
      }
      
      // Tertiary sort: year (prefer slightly older movies for variety, but not too old)
      // This helps avoid always picking the most recent films
      if (a.year && b.year) {
        // Prefer movies from 1990-2020 range (sweet spot)
        const yearA = a.year;
        const yearB = b.year;
        const inRangeA = yearA >= 1990 && yearA <= 2020;
        const inRangeB = yearB >= 1990 && yearB <= 2020;
        
        if (inRangeA && !inRangeB) return -1;
        if (!inRangeA && inRangeB) return 1;
        
        // If both in range or both out, prefer slightly older (more established)
        return yearA - yearB;
      }
      
      return 0;
    });

    // Consider top 3 candidates and add slight randomness for variety
    // This prevents the AI from always picking the exact same movie in similar situations
    const topCandidates = sortedMovies.slice(0, Math.min(3, sortedMovies.length));
    const topScore = calculateQualityScore(topCandidates[0]);
    
    // If top 3 candidates are within 5 points of each other, randomly pick from them
    // This adds variety while still maintaining quality
    const closeCandidates = topCandidates.filter(m => {
      const score = calculateQualityScore(m);
      return Math.abs(score - topScore) <= 5;
    });
    
    const selectedIndex = closeCandidates.length > 1 
      ? Math.floor(Math.random() * closeCandidates.length)
      : 0;
    
    return closeCandidates[selectedIndex] || sortedMovies[0] || null;
  } catch (error) {
    console.error('Error in makeAIPick:', error);
    return null;
  }
}
