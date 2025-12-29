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

// Function to get decade category from year
function getDecadeCategory(year) {
  if (!year || year < 1930) return null;
  
  if (year >= 1930 && year <= 1939) return "30's";
  if (year >= 1940 && year <= 1949) return "40's";
  if (year >= 1950 && year <= 1959) return "50's";
  if (year >= 1960 && year <= 1969) return "60's";
  if (year >= 1970 && year <= 1979) return "70's";
  if (year >= 1980 && year <= 1989) return "80's";
  if (year >= 1990 && year <= 1999) return "90's";
  if (year >= 2000 && year <= 2009) return "2000's";
  if (year >= 2010 && year <= 2019) return "2010's";
  if (year >= 2020 && year <= 2029) return "2020's";
  
  return null;
}

// Main function
async function addDecadeCategories() {
  console.log('🎬 Adding decade categories to New Year\'s Eve Spec Draft...\n');

  try {
    if (SUPABASE_SERVICE_KEY) {
      console.log('✓ Using service role key (admin access enabled)\n');
    } else {
      console.log('⚠️  Using anon key - may have limited permissions\n');
    }

    // Fetch all movies from the spec draft
    console.log('📥 Fetching movies from spec draft...');
    const { data: movies, error: moviesError } = await supabase
      .from('spec_draft_movies')
      .select('id, movie_title, movie_year')
      .eq('spec_draft_id', SPEC_DRAFT_ID)
      .order('movie_title', { ascending: true });

    if (moviesError) throw moviesError;
    if (!movies || movies.length === 0) {
      console.log('❌ No movies found in spec draft');
      return;
    }

    console.log(`✓ Found ${movies.length} movies\n`);

    // Process each movie
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const movie of movies) {
      const decadeCategory = getDecadeCategory(movie.movie_year);
      
      if (!decadeCategory) {
        console.log(`  ⏭️  Skipping "${movie.movie_title}" (${movie.movie_year || 'no year'}) - no decade category`);
        skippedCount++;
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
      
      // Check if decade category already exists
      if (currentCategoryNames.includes(decadeCategory)) {
        console.log(`  ✓ "${movie.movie_title}" (${movie.movie_year}) already has "${decadeCategory}"`);
        skippedCount++;
        continue;
      }

      // Add the decade category
      const { error: insertError } = await supabase
        .from('spec_draft_movie_categories')
        .insert({
          spec_draft_movie_id: movie.id,
          category_name: decadeCategory,
          is_automated: true,
        });

      if (insertError) {
        console.error(`  ❌ Error adding "${decadeCategory}" to "${movie.movie_title}":`, insertError.message);
        errors.push({ movie: movie.movie_title, category: decadeCategory, error: insertError.message });
      } else {
        console.log(`  ✓ Added "${decadeCategory}" to "${movie.movie_title}" (${movie.movie_year})`);
        updatedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total movies: ${movies.length}`);
    console.log(`✓ Updated with decade categories: ${updatedCount}`);
    console.log(`⏭️  Skipped (already had category or no year): ${skippedCount}`);
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log('\n⚠️  Errors:');
      errors.forEach(err => {
        console.log(`  - "${err.movie}": ${err.error}`);
      });
    }

    console.log(`\n✅ Decade categories added successfully!`);
    console.log(`   Spec draft ID: ${SPEC_DRAFT_ID}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
addDecadeCategories();

