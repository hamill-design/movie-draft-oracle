import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { searchQuery } = await req.json()
    
    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const tmdbApiKey = Deno.env.get('TMDB')
    if (!tmdbApiKey) {
      console.error('TMDB API key not found')
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Input validation and sanitization
    const sanitizedQuery = searchQuery.trim().slice(0, 100); // Limit length
    if (!sanitizedQuery) {
      return new Response(
        JSON.stringify({ error: 'Search query cannot be empty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Searching for people with query length:', sanitizedQuery.length)

    // Search for people using TMDB API
    const tmdbUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(sanitizedQuery)}`

    const response = await fetch(tmdbUrl)
    
    if (!response.ok) {
      console.error('TMDB API error:', response.status, response.statusText)
      throw new Error(`API request failed`)
    }

    const data = await response.json()
    console.log('TMDB API response - total results:', data.total_results, 'page:', data.page)

    // Transform the data to include relevant information
    const transformedResults = data.results?.map((person: any) => ({
      id: person.id,
      name: person.name,
      known_for_department: person.known_for_department || 'Acting',
      profile_path: person.profile_path,
      popularity: person.popularity,
      known_for: person.known_for?.map((item: any) => ({
        title: item.title || item.name,
        media_type: item.media_type,
        release_date: item.release_date || item.first_air_date
      })) || []
    })) || []

    // Detect if this is a single-name query (likely just a first name)
    const isSingleNameQuery = !sanitizedQuery.includes(' ') && sanitizedQuery.length > 2;

    // For single-name queries, apply stricter filtering to prioritize famous actors
    let filteredResults = transformedResults;
    if (isSingleNameQuery) {
      filteredResults = transformedResults.filter((person: any) => {
        // Filter out people with very low popularity (likely obscure)
        if ((person.popularity || 0) < 1.0) {
          return false;
        }
        
        // Filter out "Crew" department for single-name queries (users want actors/directors)
        if (person.known_for_department === 'Crew') {
          return false;
        }
        
        // Require either known_for items OR high popularity (>= 5.0)
        const hasKnownFor = person.known_for && person.known_for.length > 0;
        const hasHighPopularity = (person.popularity || 0) >= 5.0;
        
        return hasKnownFor || hasHighPopularity;
      });
    }

    // Calculate a composite score to prioritize famous actors/directors
    // For single-name queries, we heavily weight popularity to surface famous actors
    const calculateFameScore = (person: any, isSingleName: boolean): number => {
      // For single-name queries, multiply popularity by 3x to heavily prioritize famous people
      const popularityWeight = isSingleName ? 3 : 1;
      let score = (person.popularity || 0) * popularityWeight;
      
      // Bonus for having known_for items (indicates notable work)
      // For single-name queries, this is even more important
      if (person.known_for && person.known_for.length > 0) {
        const knownForWeight = isSingleName ? 10 : 5;
        score += person.known_for.length * knownForWeight;
      }
      
      // Bonus for having a profile picture (more established actors have photos)
      if (person.profile_path) {
        score += 15; // Increased from 10
      } else if (isSingleName) {
        // Penalty for no profile picture in single-name queries
        score -= 5;
      }
      
      // Bonus for being in Acting or Directing departments (filter out crew)
      const relevantDepartments = ['Acting', 'Directing', 'Production', 'Writing'];
      if (relevantDepartments.includes(person.known_for_department)) {
        score += 5;
      }
      
      return score;
    };

    // Sort by composite fame score (descending), then by popularity as tiebreaker
    filteredResults.sort((a: any, b: any) => {
      const scoreA = calculateFameScore(a, isSingleNameQuery);
      const scoreB = calculateFameScore(b, isSingleNameQuery);
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // Tiebreaker: use raw popularity
      return (b.popularity || 0) - (a.popularity || 0);
    });

    return new Response(
      JSON.stringify({ 
        results: filteredResults,
        total_results: data.total_results,
        page: data.page 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in search-people function:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: 'Search service temporarily unavailable' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})