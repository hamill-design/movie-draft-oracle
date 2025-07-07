
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchWithBatching, buildApiUrl } from './apiUtils.ts';
import { 
  transformMovieData, 
  transformPersonData, 
  getPersonEmoji 
} from './movieUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchQuery, category, page = 1, fetchAll = false } = await req.json();
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured');
    }

    // Build API URL based on category
    const { url, baseUrl } = await buildApiUrl(category, searchQuery, page, tmdbApiKey);

    // Handle case where no person was found
    if (!url && category === 'person') {
      return new Response(JSON.stringify({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle person search with fetchAll
    if (category === 'person_search' && fetchAll) {
      const allData = await fetchWithBatching(baseUrl);
      const transformedPeople = allData.results?.map(transformPersonData) || [];

      return new Response(JSON.stringify({
        results: transformedPeople,
        total_pages: allData.total_pages,
        total_results: allData.total_results,
        page: allData.page
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch data
    let data;
    if (fetchAll && baseUrl) {
      console.log('Fetching with smart batching for:', category);
      data = await fetchWithBatching(baseUrl);
    } else {
      const response = await fetch(url);
      data = await response.json();
    }

    // Transform movie data with selective enhancement
    const movieCount = data.results?.length || 0;
    console.log(`Processing ${movieCount} movies`);
    
    // Only enhance movies if we have a reasonable number to avoid timeouts
    const shouldEnhance = movieCount <= 50; // Only enhance if 50 movies or fewer
    
    const transformedMovies = await Promise.all(
      (data.results || []).map(async (movie: any, index: number) => {
        return await transformMovieData(movie, index, shouldEnhance, tmdbApiKey);
      })
    );

    console.log(`Returning ${transformedMovies.length} movies${shouldEnhance ? ' with full enhancement' : ' with limited enhancement'}`);

    return new Response(JSON.stringify({
      results: transformedMovies,
      total_pages: data.total_pages,
      total_results: data.total_results,
      page: data.page
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching movies from TMDB:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
