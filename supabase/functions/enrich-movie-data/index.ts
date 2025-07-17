
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== FUNCTION STARTED ===')
    
    // Initialize Supabase client first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      throw new Error('Missing Supabase configuration')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)
    console.log('Supabase client initialized')

    // Parse request body
    const requestBody = await req.json()
    const { movieId, movieTitle, movieYear } = requestBody
    
    if (!movieId || !movieTitle) {
      throw new Error('Missing required parameters: movieId and movieTitle')
    }

    console.log(`Processing: ${movieTitle} (${movieYear}) - ID: ${movieId}`)

    // Get API keys
    const omdbApiKey = Deno.env.get('OMDB')
    const tmdbApiKey = Deno.env.get('TMDB')
    
    console.log(`API Keys - OMDB: ${omdbApiKey ? 'SET' : 'MISSING'}, TMDB: ${tmdbApiKey ? 'SET' : 'MISSING'}`)

    let enrichmentData = {
      budget: null,
      revenue: null,
      rtCriticsScore: null,
      metacriticScore: null,
      imdbRating: null,
      oscarStatus: 'none',
      posterPath: null,
      movieGenre: null
    }

    // Simple timeout helper
    const fetchWithTimeout = async (url: string, timeoutMs = 5000) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      
      try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }

    // Fetch OMDB data
    if (omdbApiKey) {
      try {
        console.log('Fetching OMDB data...')
        const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${omdbApiKey}`
        
        const omdbResponse = await fetchWithTimeout(omdbUrl, 5000)
        
        if (omdbResponse.ok) {
          const omdbData = await omdbResponse.json()
          
          if (omdbData && omdbData.Response !== 'False') {
            // IMDB Rating
            if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
              const rating = parseFloat(omdbData.imdbRating)
              if (!isNaN(rating)) {
                enrichmentData.imdbRating = rating
                console.log(`IMDB: ${rating}`)
              }
            }

            // Rotten Tomatoes and Metacritic
            if (omdbData.Ratings) {
              for (const rating of omdbData.Ratings) {
                if (rating.Source === 'Rotten Tomatoes') {
                  const match = rating.Value.match(/(\d+)%/)
                  if (match) {
                    enrichmentData.rtCriticsScore = parseInt(match[1])
                    console.log(`RT: ${enrichmentData.rtCriticsScore}%`)
                  }
                } else if (rating.Source === 'Metacritic') {
                  const match = rating.Value.match(/(\d+)\/100/)
                  if (match) {
                    enrichmentData.metacriticScore = parseInt(match[1])
                    console.log(`Metacritic: ${enrichmentData.metacriticScore}/100`)
                  }
                }
              }
            }

            // Oscar status
            if (omdbData.Awards) {
              const awards = omdbData.Awards.toLowerCase()
              if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
                enrichmentData.oscarStatus = 'winner'
              } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
                enrichmentData.oscarStatus = 'nominee'
              }
              console.log(`Oscar: ${enrichmentData.oscarStatus}`)
            }
          } else {
            console.log('OMDB: No data found')
          }
        }
      } catch (error) {
        console.log(`OMDB error: ${error.message}`)
      }
    }

    // Fetch TMDB data
    if (tmdbApiKey) {
      try {
        console.log('Fetching TMDB data...')
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
        
        const tmdbResponse = await fetchWithTimeout(tmdbUrl, 5000)
        
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json()
          
          if (tmdbData && !tmdbData.status_code) {
            if (tmdbData.budget && tmdbData.budget > 0) {
              enrichmentData.budget = tmdbData.budget
              console.log(`Budget: $${enrichmentData.budget.toLocaleString()}`)
            }
            
            if (tmdbData.revenue && tmdbData.revenue > 0) {
              enrichmentData.revenue = tmdbData.revenue
              console.log(`Revenue: $${enrichmentData.revenue.toLocaleString()}`)
            }

            if (tmdbData.poster_path) {
              enrichmentData.posterPath = tmdbData.poster_path
              console.log(`Poster: ${enrichmentData.posterPath}`)
            } else {
              console.log('No poster_path found in TMDB data')
              console.log('TMDB response keys:', Object.keys(tmdbData))
            }

            // Extract genre information
            if (tmdbData.genres && tmdbData.genres.length > 0) {
              enrichmentData.movieGenre = tmdbData.genres[0].name
              console.log(`Genre: ${enrichmentData.movieGenre}`)
            } else if (tmdbData.genre_ids && tmdbData.genre_ids.length > 0) {
              enrichmentData.movieGenre = getGenreName(tmdbData.genre_ids[0])
              console.log(`Genre (from ID): ${enrichmentData.movieGenre}`)
            }
          }
        }
      } catch (error) {
        console.log(`TMDB error: ${error.message}`)
      }
    }

    // Calculate score
    const finalScore = calculateScore(enrichmentData)
    console.log(`Final score: ${finalScore}`)

    // Update database
    const updateData: any = {
      movie_budget: enrichmentData.budget,
      movie_revenue: enrichmentData.revenue,
      rt_critics_score: enrichmentData.rtCriticsScore,
      rt_audience_score: null,
      metacritic_score: enrichmentData.metacriticScore,
      imdb_rating: enrichmentData.imdbRating,
      oscar_status: enrichmentData.oscarStatus,
      poster_path: enrichmentData.posterPath,
      calculated_score: finalScore,
      scoring_data_complete: true
    }

    // Only update movie_genre if we found one
    if (enrichmentData.movieGenre) {
      updateData.movie_genre = enrichmentData.movieGenre
    }

    const { error: updateError } = await supabaseClient
      .from('draft_picks')
      .update(updateData)
      .eq('movie_id', movieId)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw updateError
    }

    console.log('SUCCESS: Database updated')

    return new Response(
      JSON.stringify({
        success: true,
        enrichmentData: {
          ...enrichmentData,
          calculatedScore: finalScore
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function calculateScore(data: any): number {
  let totalScore = 0
  let totalWeight = 0

  // Box Office (20%)
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget
    const profitPercentage = (profit / data.revenue) * 100
    const boxOfficeScore = Math.min(Math.max(profitPercentage, 0), 100)
    totalScore += boxOfficeScore * 0.2
    totalWeight += 0.2
  }

  // RT Critics (23.33%)
  if (data.rtCriticsScore) {
    totalScore += data.rtCriticsScore * 0.2333
    totalWeight += 0.2333
  }

  // Metacritic (23.33%)
  if (data.metacriticScore) {
    totalScore += data.metacriticScore * 0.2333
    totalWeight += 0.2333
  }

  // IMDB (23.33%)
  if (data.imdbRating) {
    const imdbScore = (data.imdbRating / 10) * 100
    totalScore += imdbScore * 0.2333
    totalWeight += 0.2333
  }

  // Oscar Bonus (10%)
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 100
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 50
  }
  totalScore += oscarBonus * 0.1
  totalWeight += 0.1

  const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0
  return Math.round(finalScore * 100) / 100
}

// Helper function to map genre IDs to names
function getGenreName(genreId: number): string {
  const genres: { [key: number]: string } = {
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
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
  };
  return genres[genreId] || 'Unknown';
}
