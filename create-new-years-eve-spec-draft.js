import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';

// Try to use service role key first (for admin operations), fallback to anon key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY';

// Use service role key if available (bypasses RLS), otherwise use anon key
const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Movie data organized by category (as provided by user)
// Note: Some movies appear in multiple categories - we'll collect all categories for each movie
const moviesByCategory = {
  'Action/Adventure': [
    { title: 'Assault on Precinct 13', year: 2005 },
    { title: 'Beyond the Poseidon Adventure', year: 1979 },
    { title: 'Friday Foster', year: 1975 },
    { title: 'Poseidon', year: 2006 },
    { title: 'The Poseidon Adventure', year: 1972 },
  ],
  'Comedy': [
    { title: 'Are We There Yet?', year: 2005 },
    { title: 'Bachelor Mother', year: 1939 },
    { title: 'Bloodhounds of Broadway', year: 1989 },
    { title: 'Carnival Night', year: 1956 },
    { title: 'Down and Out in Beverly Hills', year: 1986 },
    { title: "Every Day's a Holiday", year: 1937 },
    { title: 'Four Rooms', year: 1995 },
    { title: 'Get Crazy', year: 1983 },
    { title: 'Ghostbusters II', year: 1989 },
    { title: 'The Gold Rush', year: 1925 },
    { title: 'The Hudsucker Proxy', year: 1994 },
    { title: 'The Passionate Thief', year: 1960 },
    { title: 'It Happened on Fifth Avenue', year: 1947 },
    { title: 'Junior Miss', year: 1945 },
    { title: 'My Big Night', year: 2015 },
    { title: "New Year's Day", year: 2001 },
    { title: 'No Surrender', year: 1985 },
    { title: 'Operation Happy New Year', year: 1996 },
    { title: 'Operation Petticoat', year: 1959 },
    { title: 'Party Party', year: 1983 },
    { title: 'Radio Days', year: 1987 },
    { title: 'Trading Places', year: 1983 },
    { title: 'Whatever Works', year: 2009 },
  ],
  'Comedy-drama': [
    { title: '200 Cigarettes', year: 1999 },
    { title: 'Bridge and Tunnel', year: 2014 },
    { title: 'Diner', year: 1982 },
    { title: 'For Keeps', year: 1988 },
    { title: 'Forrest Gump', year: 1994 },
    { title: 'Happy New Year, Colin Burstead', year: 2018 },
    { title: 'Highball', year: 1997 },
    { title: 'The Holdovers', year: 2023 },
    { title: 'Ladies in Black', year: 2018 },
    { title: 'A Long Way Down', year: 2014 },
    { title: 'Mermaids', year: 1990 },
    { title: 'Metropolitan', year: 1990 },
    { title: 'More American Graffiti', year: 1979 },
    { title: "New Year's Day", year: 1989 },
    { title: 'One Night Stand', year: 1984 },
    { title: "Peter's Friends", year: 1992 },
    { title: 'Room for One More', year: 1952 },
    { title: 'Starter for 10', year: 2006 },
    { title: 'Surviving New Year\'s', year: 2008 },
    { title: 'Sweet Hearts Dance', year: 1988 },
  ],
  'Crime/caper/heist': [
    { title: 'After the Thin Man', year: 1936 },
    { title: 'Better Luck Tomorrow', year: 2002 },
    { title: 'La bonne année', year: 1973 },
    { title: 'Dick Tracy', year: 1990 },
    { title: 'Dhoom', year: 2004 },
    { title: 'Entrapment', year: 1999 },
    { title: 'The Godfather', year: 1972 },
    { title: 'The Godfather Part II', year: 1974 },
    { title: 'Happy New Year', year: 1987 },
    { title: 'Little Caesar', year: 1931 },
    { title: 'Money Train', year: 1995 },
    { title: 'Ocean\'s 11', year: 1960 },
    { title: 'Poor Sasha', year: 1997 },
    { title: 'A Simple Plan', year: 1998 },
  ],
  'Disaster': [
    { title: 'Beyond the Poseidon Adventure', year: 1979 },
    { title: 'Ground Control', year: 1998 },
    { title: 'Poseidon', year: 2006 },
    { title: 'The Poseidon Adventure', year: 1972 },
    { title: 'The Poseidon Adventure', year: 2005 },
    { title: 'Y2K', year: 1999 },
    { title: 'Y2K', year: 2024 },
  ],
  'Drama': [
    { title: '54', year: 1998 },
    { title: 'Boogie Nights', year: 1997 },
    { title: 'Carol', year: 2015 },
    { title: 'Cavalcade', year: 1933 },
    { title: 'The Divorcee', year: 1930 },
    { title: 'Fruitvale Station', year: 2013 },
    { title: 'Home Before Dark', year: 1958 },
    { title: "I'll Be Seeing You", year: 1944 },
    { title: 'I Never Promised You a Rose Garden', year: 1977 },
    { title: 'Looking for Mr. Goodbar', year: 1977 },
    { title: 'Middle of the Night', year: 1959 },
    { title: 'My Reputation', year: 1946 },
    { title: 'The New Year', year: 2010 },
    { title: "New Year's Eve", year: 1929 },
    { title: 'One Way Passage', year: 1932 },
    { title: 'The Passionate Friends', year: 1949 },
    { title: 'Penny Serenade', year: 1941 },
    { title: 'Phantom Thread', year: 2017 },
    { title: 'Pollock', year: 2000 },
    { title: 'Il Posto', year: 1961 },
    { title: 'Rocky', year: 1976 },
    { title: 'Rocky II', year: 1979 },
    { title: 'Splendor in the Grass', year: 1961 },
    { title: 'The Stud', year: 1978 },
    { title: "'Til We Meet Again", year: 1940 },
    { title: 'Two Lovers', year: 2008 },
    { title: "Ulysses' Gaze", year: 1995 },
    { title: 'Yanks', year: 1979 },
  ],
  'Film noir': [
    { title: 'Backfire', year: 1950 },
    { title: 'Repeat Performance', year: 1947 },
    { title: 'Sunset Boulevard', year: 1950 },
    { title: 'Walk Softly, Stranger', year: 1950 },
  ],
  'Horror': [
    { title: 'Angel Heart', year: 1987 },
    { title: 'Antisocial', year: 2013 },
    { title: 'Bloody New Year', year: 1987 },
    { title: 'The Children', year: 2008 },
    { title: 'Day Watch', year: 2006 },
    { title: 'Dead of Winter', year: 1987 },
    { title: 'End of Days', year: 1999 },
    { title: 'Ghostkeeper', year: 1981 },
    { title: 'Holidays', year: 2016 },
    { title: 'Iced', year: 1988 },
    { title: 'The Mephisto Waltz', year: 1971 },
    { title: 'Mystery of the Wax Museum', year: 1933 },
    { title: "New Year's Evil", year: 1980 },
    { title: 'The Phantom Carriage', year: 1921 },
    { title: 'The Phantom Carriage', year: 1958 },
    { title: "Rosemary's Baby", year: 1968 },
    { title: 'The Shining', year: 1980 },
    { title: 'Terror Train', year: 1980 },
    { title: 'V/H/S/99', year: 2022, note: 'segment "To Hell and Back"' },
  ],
  'Musical': [
    { title: 'An American in Paris', year: 1951 },
    { title: 'Bundle of Joy', year: 1956 },
    { title: 'Carnival Night', year: 1956 },
    { title: 'Get Crazy', year: 1983 },
    { title: 'Holiday Inn', year: 1942 },
    { title: 'New Year Adventures of Masha and Vitya', year: 1975 },
    { title: 'Rent', year: 2005 },
  ],
  'Romance/romantic comedy': [
    { title: 'About a Boy', year: 2002 },
    { title: 'About Last Night', year: 1986 },
    { title: 'About Last Night', year: 2014 },
    { title: 'An Affair to Remember', year: 1957 },
    { title: 'And So They Were Married', year: 1936 },
    { title: 'The Apartment', year: 1960 },
    { title: 'Baby Cakes', year: 1989 },
    { title: 'Bachelor Mother', year: 1939 },
    { title: "Bridget Jones's Diary", year: 2001 },
    { title: 'Café Society', year: 2016 },
    { title: "Can't Buy Me Love", year: 1987 },
    { title: 'Come Look at Me', year: 2001 },
    { title: 'Desk Set', year: 1957 },
    { title: 'Holiday', year: 1938 },
    { title: 'The Holiday', year: 2006 },
    { title: 'Holiday Affair', year: 1949 },
    { title: 'In Search of a Midnight Kiss', year: 2008 },
    { title: 'The Irony of Fate', year: 1976 },
    { title: 'The Irony of Fate 2', year: 2007 },
    { title: "It's Love I'm After", year: 1937 },
    { title: 'Made for Each Other', year: 1939 },
    { title: "The Moon's Our Home", year: 1936 },
    { title: "New Year's Eve", year: 2011 },
    { title: 'Remember the Night', year: 1940 },
    { title: 'The Rose Bowl Story', year: 1952 },
    { title: 'Sex and the City: The Movie', year: 2008 },
    { title: 'Sleepless in Seattle', year: 1993 },
    { title: 'Someone Like You', year: 2001 },
    { title: 'Untamed Heart', year: 1993 },
    { title: 'When Harry Met Sally...', year: 1989 },
    { title: 'While You Were Sleeping', year: 1995 },
    { title: 'Yolki', year: 2010 },
    { title: 'Yolki 2', year: 2011 },
    { title: 'Yolki 3', year: 2013 },
    { title: 'Yolki 1914', year: 2014 },
    { title: 'Yolki 5', year: 2016 },
  ],
  'Science fiction': [
    { title: 'Alien Nation: Millennium', year: 1996 },
    { title: 'Black Lightning', year: 2009 },
    { title: 'Doctor Who', year: 1996 },
    { title: 'The End of Evangelion', year: 1997 },
    { title: 'Snowpiercer', year: 2013 },
    { title: 'Strange Days', year: 1995 },
    { title: 'The Time Machine', year: 1960 },
  ],
  'Thriller': [
    { title: 'Bitter Moon', year: 1992 },
    { title: 'Night Train to Paris', year: 1964 },
    { title: 'Survivor', year: 2015 },
    { title: 'Taboo', year: 2002 },
    { title: 'Under Suspicion', year: 2000 },
  ],
};

// Standard categories in the system
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

// Map category names to standard category names used in the system
// Categories not in this map will be created as custom categories
const categoryMapping = {
  'Action/Adventure': 'Action/Adventure',
  'Comedy': 'Comedy',
  'Comedy-drama': 'Drama/Romance',
  'Crime/caper/heist': 'Horror/Thriller',
  'Disaster': 'Sci-Fi/Fantasy',
  'Drama': 'Drama/Romance',
  'Film noir': 'Horror/Thriller',
  'Horror': 'Horror/Thriller',
  'Romance/romantic comedy': 'Drama/Romance',
  'Science fiction': 'Sci-Fi/Fantasy',
  'Thriller': 'Horror/Thriller',
  // 'Musical' will be created as a custom category
};

// Helper function to search for a movie
async function searchMovie(title, year) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-movies', {
      body: {
        category: 'search',
        searchQuery: title,
        fetchAll: false,
        page: 1,
      },
    });

    if (error) {
      console.error(`Error searching for "${title}":`, error);
      return null;
    }

    const results = data?.results || [];
    
    // Try to find exact match by title and year
    let bestMatch = results.find(m => {
      const resultYear = m.year || (m.release_date ? parseInt(m.release_date.split('-')[0]) : null);
      return m.title === title && resultYear === year;
    });

    // If no exact match, try fuzzy match
    if (!bestMatch && results.length > 0) {
      bestMatch = results[0]; // Take first result
      console.log(`⚠️  Using first result for "${title}" (${year}): "${bestMatch.title}" (${bestMatch.year || 'unknown year'})`);
    }

    return bestMatch || null;
  } catch (err) {
    console.error(`Exception searching for "${title}":`, err);
    return null;
  }
}

// Helper function to add movie to spec draft
async function addMovieToSpecDraft(specDraftId, movie, categories) {
  try {
    // Check if movie already exists
    const { data: existing } = await supabase
      .from('spec_draft_movies')
      .select('id')
      .eq('spec_draft_id', specDraftId)
      .eq('movie_tmdb_id', movie.id)
      .single();

    if (existing) {
      console.log(`  ✓ Movie "${movie.title}" already exists, updating categories...`);
      const specDraftMovieId = existing.id;
      
      // Delete existing categories
      await supabase
        .from('spec_draft_movie_categories')
        .delete()
        .eq('spec_draft_movie_id', specDraftMovieId);

      // Add new categories
      if (categories.length > 0) {
        const categoriesToInsert = categories.map(categoryName => ({
          spec_draft_movie_id: specDraftMovieId,
          category_name: categoryName,
          is_automated: false,
        }));

        await supabase
          .from('spec_draft_movie_categories')
          .insert(categoriesToInsert);
      }

      return existing.id;
    }

    // Insert movie
    const { data: movieData, error: insertError } = await supabase
      .from('spec_draft_movies')
      .insert({
        spec_draft_id: specDraftId,
        movie_tmdb_id: movie.id,
        movie_title: movie.title,
        movie_year: movie.year || null,
        movie_poster_path: movie.posterPath || movie.poster_path || null,
        movie_genres: movie.genres || movie.genre_ids || [],
        oscar_status: movie.oscar_status || movie.oscarStatus || null,
        revenue: movie.revenue || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Add categories
    if (categories.length > 0 && movieData) {
      const categoriesToInsert = categories.map(categoryName => ({
        spec_draft_movie_id: movieData.id,
        category_name: categoryName,
        is_automated: false,
      }));

      const { error: categoriesError } = await supabase
        .from('spec_draft_movie_categories')
        .insert(categoriesToInsert);

      if (categoriesError) {
        console.error(`  ⚠️  Error adding categories:`, categoriesError);
      }
    }

    return movieData.id;
  } catch (err) {
    console.error(`  ❌ Error adding movie "${movie.title}":`, err);
    throw err;
  }
}

// Build a map of movies to their categories (handles movies in multiple categories)
function buildMovieCategoryMap() {
  const movieMap = new Map();
  const customCategoriesNeeded = new Set();
  
  for (const [categoryName, movies] of Object.entries(moviesByCategory)) {
    // Map to standard category, or use as-is if not in mapping
    const mappedCategory = categoryMapping[categoryName];
    const finalCategory = mappedCategory || categoryName;
    
    // Track custom categories needed (categories that aren't standard)
    if (!standardCategories.includes(finalCategory)) {
      customCategoriesNeeded.add(finalCategory);
    }
    
    for (const movie of movies) {
      const key = `${movie.title}|${movie.year}`;
      if (!movieMap.has(key)) {
        movieMap.set(key, {
          title: movie.title,
          year: movie.year,
          categories: new Set(),
        });
      }
      movieMap.get(key).categories.add(finalCategory);
    }
  }
  
  return { movieMap, customCategoriesNeeded };
}

// Create custom categories for a spec draft
async function createCustomCategories(specDraftId, categoryNames) {
  const created = [];
  for (const categoryName of categoryNames) {
    try {
      const { data, error } = await supabase
        .from('spec_draft_categories')
        .insert({
          spec_draft_id: specDraftId,
          category_name: categoryName,
          description: null,
        })
        .select()
        .single();

      if (error) {
        // Check if it already exists
        if (error.code === '23505') {
          console.log(`  ✓ Custom category "${categoryName}" already exists`);
          created.push(categoryName);
        } else {
          console.error(`  ⚠️  Error creating custom category "${categoryName}":`, error.message);
        }
      } else {
        console.log(`  ✓ Created custom category: "${categoryName}"`);
        created.push(categoryName);
      }
    } catch (err) {
      console.error(`  ⚠️  Exception creating custom category "${categoryName}":`, err.message);
    }
  }
  return created;
}

// Main function
async function createNewYearsEveSpecDraft() {
  console.log('🎬 Creating New Year\'s Eve Spec Draft...\n');

  try {
    // Check if we're using service role key
    if (SUPABASE_SERVICE_KEY) {
      console.log('✓ Using service role key (admin access enabled)\n');
    } else {
      console.log('⚠️  Using anon key - may have limited permissions');
      console.log('   For admin operations, set SUPABASE_SERVICE_KEY environment variable\n');
      
      // Try to check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('⚠️  Not authenticated. Attempting to proceed...');
        console.log('   Note: You may need to authenticate if RLS policies require it.\n');
      } else {
        console.log(`✓ Authenticated as: ${user.email || user.id}\n`);
      }
    }

    // Create spec draft
    console.log('📝 Creating spec draft...');
    const { data: specDraft, error: createError } = await supabase
      .from('spec_drafts')
      .insert({
        name: "New Year's Eve",
        description: 'Movies set on or around New Year\'s Eve',
      })
      .select()
      .single();

    if (createError) {
      // Check if it already exists
      if (createError.code === '23505') {
        console.log('⚠️  Spec draft already exists, fetching existing one...');
        const { data: existing } = await supabase
          .from('spec_drafts')
          .select('*')
          .eq('name', "New Year's Eve")
          .single();
        
        if (existing) {
          console.log(`✓ Using existing spec draft (ID: ${existing.id})\n`);
          var specDraftId = existing.id;
        } else {
          throw createError;
        }
      } else {
        throw createError;
      }
    } else {
      console.log(`✓ Spec draft created (ID: ${specDraft.id})\n`);
      var specDraftId = specDraft.id;
    }

    // Build movie category map (handles movies in multiple categories)
    const { movieMap, customCategoriesNeeded } = buildMovieCategoryMap();
    const uniqueMovies = Array.from(movieMap.values());
    
    console.log(`\n📊 Found ${uniqueMovies.length} unique movies across all categories`);
    
    // Create custom categories if needed
    if (customCategoriesNeeded.size > 0) {
      console.log(`\n📝 Creating ${customCategoriesNeeded.size} custom categories...`);
      await createCustomCategories(specDraftId, Array.from(customCategoriesNeeded));
      console.log('');
    }

    // Process movies
    let totalMovies = uniqueMovies.length;
    let successCount = 0;
    let failCount = 0;
    const failedMovies = [];
    const processedMovies = new Set(); // Track which movies we've already processed

    for (const movie of uniqueMovies) {
      const movieKey = `${movie.title}|${movie.year}`;
      
      // Skip if already processed (shouldn't happen, but safety check)
      if (processedMovies.has(movieKey)) {
        continue;
      }
      processedMovies.add(movieKey);
      
      const categories = Array.from(movie.categories).sort();
      console.log(`  🔍 Searching for: "${movie.title}" (${movie.year})...`);
      console.log(`     Categories: ${categories.join(', ')}`);
      
      const searchResult = await searchMovie(movie.title, movie.year);
      
      if (searchResult) {
        try {
          await addMovieToSpecDraft(specDraftId, searchResult, categories);
          console.log(`  ✓ Added: "${searchResult.title}" (${searchResult.year || 'unknown year'})`);
          successCount++;
        } catch (err) {
          console.error(`  ❌ Failed to add: "${movie.title}":`, err.message);
          failCount++;
          failedMovies.push({ ...movie, error: err.message });
        }
      } else {
        console.log(`  ⚠️  Not found: "${movie.title}" (${movie.year})`);
        failCount++;
        failedMovies.push({ ...movie, error: 'Movie not found in TMDB' });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total movies: ${totalMovies}`);
    console.log(`✓ Successfully added: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    if (failedMovies.length > 0) {
      console.log('\n⚠️  Failed movies:');
      failedMovies.forEach(movie => {
        console.log(`  - "${movie.title}" (${movie.year}): ${movie.error}`);
      });
    }

    console.log(`\n✅ Spec draft created! ID: ${specDraftId}`);
    console.log(`   View it at: https://zduruulowyopdstihfwk.supabase.co/app/project/zduruulowyopdstihfwk\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
createNewYearsEveSpecDraft();

