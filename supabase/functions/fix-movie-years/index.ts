import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== FIX MOVIE YEARS STARTED ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tmdbApiKey = Deno.env.get('TMDB')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');

    // Find draft picks with suspicious years (like 2025 for classic movies)
    const { data: suspiciousPicks, error: fetchError } = await supabase
      .from('draft_picks')
      .select('id, movie_id, movie_title, movie_year, draft_id')
      .gte('movie_year', 2024); // Movies with years 2024 or later are suspicious

    if (fetchError) {
      console.error('Error fetching suspicious picks:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${suspiciousPicks?.length || 0} suspicious movie picks to fix`);

    if (!suspiciousPicks || suspiciousPicks.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No suspicious movie years found',
        fixed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let fixedCount = 0;

    for (const pick of suspiciousPicks) {
      try {
        console.log(`Checking movie: ${pick.movie_title} (ID: ${pick.movie_id}, Current Year: ${pick.movie_year})`);
        
        // Get correct movie data from TMDB
        const tmdbResponse = await fetch(`https://api.themoviedb.org/3/movie/${pick.movie_id}?api_key=${tmdbApiKey}`);
        
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();
          const correctYear = tmdbData.release_date ? parseInt(tmdbData.release_date.substring(0, 4)) : null;
          
          if (correctYear && correctYear !== pick.movie_year) {
            console.log(`Fixing ${pick.movie_title}: ${pick.movie_year} → ${correctYear}`);
            
            // Update the draft pick with correct year
            const { error: updateError } = await supabase
              .from('draft_picks')
              .update({ movie_year: correctYear })
              .eq('id', pick.id);

            if (updateError) {
              console.error(`Error updating pick ${pick.id}:`, updateError);
            } else {
              fixedCount++;
              console.log(`✓ Fixed ${pick.movie_title}`);
            }
          } else {
            console.log(`Year for ${pick.movie_title} is already correct or couldn't be determined`);
          }
        } else {
          console.log(`Could not fetch TMDB data for movie ID ${pick.movie_id}`);
        }
      } catch (error) {
        console.error(`Error processing pick ${pick.id}:`, error);
      }
    }

    console.log(`Fixed ${fixedCount} movie years`);

    return new Response(JSON.stringify({ 
      message: `Successfully fixed ${fixedCount} movie years`,
      total_checked: suspiciousPicks.length,
      fixed: fixedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fix-movie-years function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});