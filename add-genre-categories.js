import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY';

const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Spec draft ID for "New Year's Eve"
const SPEC_DRAFT_ID = 'd47eb225-3717-4c62-a83b-0cf609904eee';

// TMDB genre ID to name mapping (same as in specDraftGenreMapper.ts)
const TMDB_GENRE_MAP = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

// Function to get genre name from ID
function getGenreName(genreId) {
  return TMDB_GENRE_MAP[genreId] || 'Unknown';
}

// Function to map genres to categories (same logic as mapGenresToCategories)
function mapGenresToCategories(genreIds) {
  const categories = [];

  if (!genreIds || !Array.isArray(genreIds) || genreIds.length === 0) {
    return categories;
  }

  // Convert genre IDs to genre string
  const genreString = genreIds
    .map(id => getGenreName(id))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Genre-based categories (using same string matching logic)
  if (genreString.includes('action') || genreString.includes('adventure')) {
    categories.push('Action/Adventure');
  }
  if (genreString.includes('animation') || genreString.includes('animated')) {
    categories.push('Animated');
  }
  if (genreString.includes('comedy')) {
    categories.push('Comedy');
  }
  if (genreString.includes('drama') || genreString.includes('romance')) {
    categories.push('Drama/Romance');
  }
  if (genreString.includes('sci-fi') || genreString.includes('science fiction') || 
      genreString.includes('fantasy') || genreString.includes('science')) {
    categories.push('Sci-Fi/Fantasy');
  }
  if (genreString.includes('horror') || genreString.includes('thriller')) {
    categories.push('Horror/Thriller');
  }

  return [...new Set(categories)]; // Remove duplicates
}

// Function to fetch genre data from TMDB if missing
// We'll use fetch-movies with a search, but actually we need to get it from the movie detail
// Since we can't call TMDB directly, let's use the fetch-movies search function
async function fetchGenresFromTMDB(tmdbId, movieTitle) {
  try {
    // Use fetch-movies to search for the movie by title
    // This will return genre_ids in the results
    const { data: fetchData, error: fetchError } = await supabase.functions.invoke('fetch-movies', {
      body: {
        category: 'search',
        searchQuery: movieTitle,
        fetchAll: false,
        page: 1,
      },
    });

    if (!fetchError && fetchData?.results && fetchData.results.length > 0) {
      // Find the movie with matching TMDB ID
      const movie = fetchData.results.find(m => (m.id === tmdbId || m.tmdbId === tmdbId));
      if (movie) {
        // Check for genre_ids
        if (movie.genre_ids && Array.isArray(movie.genre_ids) && movie.genre_ids.length > 0) {
          return movie.genre_ids;
        }
        // Or check genres array
        if (movie.genres && Array.isArray(movie.genres)) {
          // Convert genre objects to IDs
          return movie.genres.map(g => typeof g === 'object' ? (g.id || g) : g);
        }
      }
    }
  } catch (err) {
    // Silently fail - we'll skip this movie
  }
  return null;
}

// Main function
async function addGenreCategories() {
  console.log('🎬 Adding genre-based categories to New Year\'s Eve Spec Draft...\n');

  try {
    if (SUPABASE_SERVICE_KEY) {
      console.log('✓ Using service role key (admin access enabled)\n');
    } else {
      console.log('⚠️  Using anon key - may have limited permissions\n');
    }

    // Fetch all movies from the spec draft with their genres
    console.log('📥 Fetching movies from spec draft...');
    const { data: movies, error: moviesError } = await supabase
      .from('spec_draft_movies')
      .select('id, movie_title, movie_year, movie_genres, movie_tmdb_id')
      .eq('spec_draft_id', SPEC_DRAFT_ID)
      .order('movie_title', { ascending: true });

    if (moviesError) throw moviesError;
    if (!movies || movies.length === 0) {
      console.log('❌ No movies found in spec draft');
      return;
    }

    console.log(`✓ Found ${movies.length} movies\n`);

    // Process each movie
    let totalAdded = 0;
    let moviesUpdated = 0;
    let skippedNoGenres = 0;
    let genresFetched = 0;
    const errors = [];

    for (const movie of movies) {
      let genreIds = movie.movie_genres;

      // If no genre data, try to fetch from TMDB
      if (!genreIds || genreIds.length === 0) {
        console.log(`  🔍 Fetching genres for "${movie.movie_title}" (TMDB ID: ${movie.movie_tmdb_id})...`);
        const fetchedGenres = await fetchGenresFromTMDB(movie.movie_tmdb_id, movie.movie_title);
        
        if (fetchedGenres && fetchedGenres.length > 0) {
          genreIds = fetchedGenres;
          genresFetched++;
          
          // Update the movie record with the fetched genres
          const { error: updateError } = await supabase
            .from('spec_draft_movies')
            .update({ movie_genres: genreIds })
            .eq('id', movie.id);
          
          if (updateError) {
            console.log(`  ⚠️  Could not update genres in database: ${updateError.message}`);
          } else {
            console.log(`  ✓ Fetched genres: ${genreIds.map(id => getGenreName(id)).join(', ')}`);
          }
        } else {
          console.log(`  ⏭️  Skipping "${movie.movie_title}" - could not fetch genre data`);
          skippedNoGenres++;
          continue;
        }
        
        // Small delay after fetching to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Get genre-based categories
      const genreCategories = mapGenresToCategories(genreIds);

      if (genreCategories.length === 0) {
        const genreNames = genreIds.map(id => getGenreName(id)).join(', ');
        console.log(`  ⏭️  Skipping "${movie.movie_title}" - no matching genre categories (genres: ${genreNames})`);
        skippedNoGenres++;
        continue;
      }

      // Fetch current categories for this movie
      const { data: currentCategories, error: categoriesError } = await supabase
        .from('spec_draft_movie_categories')
        .select('category_name')
        .eq('spec_draft_movie_id', movie.id);

      if (categoriesError) {
        console.error(`  ❌ Error fetching categories for "${movie.movie_title}":`, categoriesError.message);
        errors.push({ movie: movie.movie_title, error: categoriesError.message });
        continue;
      }

      const currentCategoryNames = (currentCategories || []).map(c => c.category_name);
      
      // Find categories to add (not already present)
      const categoriesToAdd = genreCategories.filter(cat => !currentCategoryNames.includes(cat));

      if (categoriesToAdd.length === 0) {
        const genreNames = (movie.movie_genres || []).map(id => getGenreName(id)).join(', ');
        console.log(`  ✓ "${movie.movie_title}" already has all genre categories (${genreNames})`);
        continue;
      }

      // Add the missing genre categories
      const categoriesToInsert = categoriesToAdd.map(categoryName => ({
        spec_draft_movie_id: movie.id,
        category_name: categoryName,
        is_automated: true,
      }));

      const { error: insertError } = await supabase
        .from('spec_draft_movie_categories')
        .insert(categoriesToInsert);

      if (insertError) {
        console.error(`  ❌ Error adding categories to "${movie.movie_title}":`, insertError.message);
        errors.push({ movie: movie.movie_title, categories: categoriesToAdd, error: insertError.message });
      } else {
        const genreNames = (movie.movie_genres || []).map(id => getGenreName(id)).join(', ');
        console.log(`  ✓ Added to "${movie.movie_title}": ${categoriesToAdd.join(', ')} (genres: ${genreNames})`);
        totalAdded += categoriesToAdd.length;
        moviesUpdated++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total movies processed: ${movies.length}`);
    console.log(`✓ Movies updated with genre categories: ${moviesUpdated}`);
    console.log(`✓ Total genre categories added: ${totalAdded}`);
    console.log(`🔍 Genres fetched from TMDB: ${genresFetched}`);
    console.log(`⏭️  Skipped (no genres or already had categories): ${skippedNoGenres}`);
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log('\n⚠️  Errors:');
      errors.forEach(err => {
        console.log(`  - "${err.movie}": ${err.error}`);
      });
    }

    console.log(`\n✅ Genre categories added successfully!`);
    console.log(`   Spec draft ID: ${SPEC_DRAFT_ID}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
addGenreCategories();

