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

// Function to enrich movie data if missing
async function enrichMovieData(movie) {
  // First check oscar_cache
  const { data: oscarCache } = await supabase
    .from('oscar_cache')
    .select('oscar_status')
    .eq('tmdb_id', movie.movie_tmdb_id)
    .maybeSingle();

  let oscarStatus = movie.oscar_status;
  let revenue = movie.revenue;

  // If we have oscar status from cache, use it
  if (oscarCache && oscarCache.oscar_status) {
    oscarStatus = oscarCache.oscar_status;
  }

  // If we still don't have oscar status or revenue, try to enrich
  if ((!oscarStatus || oscarStatus === 'unknown') || !revenue) {
    try {
      console.log(`  🔍 Enriching data for "${movie.movie_title}"...`);
      const { data: enrichmentData, error: enrichError } = await supabase.functions.invoke('enrich-movie-data', {
        body: {
          movieId: movie.movie_tmdb_id,
          movieTitle: movie.movie_title,
          movieYear: movie.movie_year
        }
      });

      if (!enrichError && enrichmentData?.enrichmentData) {
        const enriched = enrichmentData.enrichmentData;
        if (!oscarStatus || oscarStatus === 'unknown') {
          oscarStatus = enriched.oscarStatus || enriched.oscar_status || 'unknown';
        }
        if (!revenue) {
          revenue = enriched.revenue || null;
        }

        // Update the spec_draft_movies record with the enriched data
        await supabase
          .from('spec_draft_movies')
          .update({
            oscar_status: oscarStatus !== 'unknown' ? oscarStatus : null,
            revenue: revenue || null
          })
          .eq('id', movie.id);
      }
    } catch (err) {
      console.log(`  ⚠️  Could not enrich "${movie.movie_title}":`, err.message);
    }
  }

  return { oscarStatus, revenue };
}

// Main function
async function addOscarBlockbusterCategories() {
  console.log('🎬 Adding Academy Award and Blockbuster categories to New Year\'s Eve Spec Draft...\n');

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
      .select('id, movie_title, movie_year, movie_tmdb_id, oscar_status, revenue')
      .eq('spec_draft_id', SPEC_DRAFT_ID)
      .order('movie_title', { ascending: true });

    if (moviesError) throw moviesError;
    if (!movies || movies.length === 0) {
      console.log('❌ No movies found in spec draft');
      return;
    }

    console.log(`✓ Found ${movies.length} movies\n`);

    // Process each movie
    let oscarAdded = 0;
    let blockbusterAdded = 0;
    let oscarSkipped = 0;
    let blockbusterSkipped = 0;
    let enriched = 0;
    const errors = [];

    for (const movie of movies) {
      console.log(`\n🎬 Processing: "${movie.movie_title}" (${movie.movie_year || 'no year'})`);

      // Enrich data if needed
      let oscarStatus = movie.oscar_status;
      let revenue = movie.revenue;

      if ((!oscarStatus || oscarStatus === 'unknown') || !revenue) {
        const enrichedData = await enrichMovieData(movie);
        oscarStatus = enrichedData.oscarStatus || oscarStatus;
        revenue = enrichedData.revenue || revenue;
        if (enrichedData.oscarStatus || enrichedData.revenue) {
          enriched++;
        }
      }

      // Fetch current categories for this movie
      const { data: currentCategories, error: categoriesError } = await supabase
        .from('spec_draft_movie_categories')
        .select('category_name')
        .eq('spec_draft_movie_id', movie.id);

      if (categoriesError) {
        console.error(`  ❌ Error fetching categories:`, categoriesError.message);
        errors.push({ movie: movie.movie_title, error: categoriesError.message });
        continue;
      }

      const currentCategoryNames = (currentCategories || []).map(c => c.category_name);
      const categoriesToAdd = [];

      // Check for Academy Award
      const hasOscar = oscarStatus === 'winner' || oscarStatus === 'nominee';
      if (hasOscar && !currentCategoryNames.includes('Academy Award Nominee or Winner')) {
        categoriesToAdd.push('Academy Award Nominee or Winner');
        console.log(`  🏆 Academy Award ${oscarStatus === 'winner' ? 'Winner' : 'Nominee'}`);
      } else if (hasOscar) {
        console.log(`  ✓ Already has Academy Award category`);
        oscarSkipped++;
      }

      // Check for Blockbuster (revenue >= $50M)
      const isBlockbuster = revenue && revenue >= 50000000;
      if (isBlockbuster && !currentCategoryNames.includes('Blockbuster (minimum of $50 Mil)')) {
        categoriesToAdd.push('Blockbuster (minimum of $50 Mil)');
        const revenueInMillions = (revenue / 1000000).toFixed(1);
        console.log(`  💰 Blockbuster ($${revenueInMillions}M revenue)`);
      } else if (isBlockbuster) {
        console.log(`  ✓ Already has Blockbuster category`);
        blockbusterSkipped++;
      }

      // Add categories if any
      if (categoriesToAdd.length > 0) {
        const categoriesToInsert = categoriesToAdd.map(categoryName => ({
          spec_draft_movie_id: movie.id,
          category_name: categoryName,
          is_automated: true,
        }));

        const { error: insertError } = await supabase
          .from('spec_draft_movie_categories')
          .insert(categoriesToInsert);

        if (insertError) {
          console.error(`  ❌ Error adding categories:`, insertError.message);
          errors.push({ movie: movie.movie_title, categories: categoriesToAdd, error: insertError.message });
        } else {
          if (categoriesToAdd.includes('Academy Award Nominee or Winner')) {
            oscarAdded++;
          }
          if (categoriesToAdd.includes('Blockbuster (minimum of $50 Mil)')) {
            blockbusterAdded++;
          }
          console.log(`  ✓ Added categories: ${categoriesToAdd.join(', ')}`);
        }
      } else if (!hasOscar && !isBlockbuster) {
        console.log(`  ⏭️  No Academy Award or Blockbuster status`);
      }

      // Small delay to avoid rate limiting (especially for enrichment)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total movies processed: ${movies.length}`);
    console.log(`🏆 Academy Award categories added: ${oscarAdded}`);
    console.log(`💰 Blockbuster categories added: ${blockbusterAdded}`);
    console.log(`✓ Already had Academy Award: ${oscarSkipped}`);
    console.log(`✓ Already had Blockbuster: ${blockbusterSkipped}`);
    console.log(`🔍 Movies enriched with data: ${enriched}`);
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log('\n⚠️  Errors:');
      errors.forEach(err => {
        console.log(`  - "${err.movie}": ${err.error}`);
      });
    }

    console.log(`\n✅ Categories added successfully!`);
    console.log(`   Spec draft ID: ${SPEC_DRAFT_ID}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
addOscarBlockbusterCategories();

