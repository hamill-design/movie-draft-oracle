
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePopularMovies, handleSearchMovies, handleYearMovies } from './handlers/movieHandlers.ts';
import { handlePersonMovies, handlePersonSearch } from './handlers/personHandlers.ts';

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

    let result;

    // Route to appropriate handler based on category
    switch (category) {
      case 'popular':
        result = await handlePopularMovies(tmdbApiKey, page, fetchAll);
        break;
      case 'search':
        result = await handleSearchMovies(tmdbApiKey, searchQuery, page, fetchAll);
        break;
      case 'year':
        result = await handleYearMovies(tmdbApiKey, searchQuery, page, fetchAll);
        break;
      case 'person':
        result = await handlePersonMovies(tmdbApiKey, searchQuery, page, fetchAll);
        break;
      case 'person_search':
        result = await handlePersonSearch(tmdbApiKey, searchQuery, page, fetchAll);
        break;
      default:
        result = await handlePopularMovies(tmdbApiKey, page, fetchAll);
    }

    console.log(`Returning ${result.results.length} results`);

    return new Response(JSON.stringify(result), {
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
