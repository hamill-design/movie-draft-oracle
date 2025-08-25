
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
    const omdbApiKey = Deno.env.get('OMDB_API_KEY')
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

    // Fetch TMDB data first to get IMDB ID for consistent matching
    let tmdbData = null
    let tmdbImdbId = null
    
    if (tmdbApiKey) {
      try {
        console.log('Fetching TMDB data...')
        
        tmdbData = await findBestTmdbMatch(movieTitle, movieYear, movieId, tmdbApiKey, fetchWithTimeout)
        
        if (tmdbData) {
          console.log(`TMDB: Successfully found "${tmdbData.title}" (${tmdbData.release_date?.substring(0, 4)})`)
          
          // Extract IMDB ID for consistent OMDB lookup
          if (tmdbData.imdb_id) {
            tmdbImdbId = tmdbData.imdb_id
            console.log(`TMDB: Found IMDB ID ${tmdbImdbId} for consistent OMDB lookup`)
          }
          
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
          }

          // Extract genre information
          if (tmdbData.genres && tmdbData.genres.length > 0) {
            enrichmentData.movieGenre = tmdbData.genres[0].name
            console.log(`Genre: ${enrichmentData.movieGenre}`)
          } else if (tmdbData.genre_ids && tmdbData.genre_ids.length > 0) {
            enrichmentData.movieGenre = getGenreName(tmdbData.genre_ids[0])
            console.log(`Genre (from ID): ${enrichmentData.movieGenre}`)
          }
        } else {
          console.log('TMDB: No suitable match found after enhanced search')
        }
      } catch (error) {
        console.log(`TMDB error: ${error.message}`)
      }
    }

    // Fetch OMDB data using TMDB's IMDB ID for consistency, or fallback to enhanced matching
    if (omdbApiKey) {
      try {
        console.log('Fetching OMDB data...')
        
        let omdbData = null
        
        // First try using TMDB's IMDB ID if available
        if (tmdbImdbId) {
          console.log(`OMDB: Using TMDB IMDB ID ${tmdbImdbId} for consistent lookup`)
          try {
            const imdbUrl = `http://www.omdbapi.com/?i=${tmdbImdbId}&apikey=${omdbApiKey}`
            const response = await fetchWithTimeout(imdbUrl, 8000)
            
            if (response.ok) {
              const data = await response.json()
              
              if (data && data.Response !== 'False' && data.Title) {
                omdbData = data
                console.log(`OMDB: Successfully found "${data.Title}" (${data.Year}) using TMDB IMDB ID`)
              } else {
                console.log('OMDB: IMDB ID lookup failed, falling back to search')
              }
            }
          } catch (error) {
            console.log(`OMDB: IMDB ID lookup failed (${error.message}), falling back to search`)
          }
        }
        
        // Fallback to enhanced matching if IMDB ID lookup failed
        if (!omdbData) {
          console.log('OMDB: Using fallback search with enhanced matching')
          omdbData = await findBestOmdbMatch(movieTitle, movieYear, movieId, omdbApiKey, fetchWithTimeout)
        }
        
        if (omdbData) {
          const source = tmdbImdbId ? 'IMDB ID from TMDB' : 'enhanced search'
          console.log(`OMDB: Successfully found "${omdbData.Title}" (${omdbData.Year}) via ${source}`)
          
          // IMDB Rating
          if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const rating = parseFloat(omdbData.imdbRating)
            if (!isNaN(rating)) {
              enrichmentData.imdbRating = rating
              console.log(`IMDB: ${rating}`)
            }
          }

          // Rotten Tomatoes and Metacritic
          if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
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
          console.log('OMDB: No data found after all attempts')
        }
      } catch (error) {
        console.log(`OMDB error: ${error.message}`)
      }
    }

    // Calculate score
    const finalScore = calculateScore(enrichmentData)
    console.log(`Final score: ${finalScore}`)

    // Determine if scoring data is actually complete
    const hasMinimumData = enrichmentData.imdbRating || enrichmentData.rtCriticsScore || enrichmentData.metacriticScore
    const scoringComplete = hasMinimumData && (enrichmentData.budget && enrichmentData.revenue)
    
    console.log(`Scoring completeness: IMDB=${!!enrichmentData.imdbRating}, RT=${!!enrichmentData.rtCriticsScore}, Meta=${!!enrichmentData.metacriticScore}, BoxOffice=${!!(enrichmentData.budget && enrichmentData.revenue)}`)

    // Update database with explicit type validation
    const updateData: any = {}
    
    // Only add fields that have actual values and validate types
    if (enrichmentData.budget !== null && typeof enrichmentData.budget === 'number') {
      updateData.movie_budget = enrichmentData.budget
    }
    
    if (enrichmentData.revenue !== null && typeof enrichmentData.revenue === 'number') {
      updateData.movie_revenue = enrichmentData.revenue
    }
    
    if (enrichmentData.rtCriticsScore !== null && typeof enrichmentData.rtCriticsScore === 'number') {
      updateData.rt_critics_score = enrichmentData.rtCriticsScore
    }
    
    if (enrichmentData.metacriticScore !== null && typeof enrichmentData.metacriticScore === 'number') {
      updateData.metacritic_score = enrichmentData.metacriticScore
    }
    
    if (enrichmentData.imdbRating !== null && typeof enrichmentData.imdbRating === 'number') {
      updateData.imdb_rating = enrichmentData.imdbRating
    }
    
    if (enrichmentData.oscarStatus && typeof enrichmentData.oscarStatus === 'string') {
      updateData.oscar_status = enrichmentData.oscarStatus
    }
    
    if (enrichmentData.posterPath && typeof enrichmentData.posterPath === 'string') {
      updateData.poster_path = enrichmentData.posterPath
    }
    
    if (enrichmentData.movieGenre && typeof enrichmentData.movieGenre === 'string') {
      updateData.movie_genre = enrichmentData.movieGenre
    }
    
    // Always update calculated score and completion status
    updateData.calculated_score = typeof finalScore === 'number' ? finalScore : null
    updateData.scoring_data_complete = typeof scoringComplete === 'boolean' ? scoringComplete : false
    
    console.log('Update data to be sent:', JSON.stringify(updateData, null, 2))

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

// Enhanced OMDB matching with intelligent year handling and validation
async function findBestOmdbMatch(movieTitle: string, movieYear: number, movieId: number, apiKey: string, fetchWithTimeout: Function): Promise<any> {
  console.log(`Enhanced OMDB search for: "${movieTitle}" (${movieYear})`)
  
  // Generate search attempts with various strategies
  const searchAttempts = [
    // 1. Exact title and year match
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${apiKey}`, strategy: 'exact_year', priority: 10 },
    
    // 2. Try ±1-2 years (common for release date variations)
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear - 1}&apikey=${apiKey}`, strategy: 'year_minus_1', priority: 8 },
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear + 1}&apikey=${apiKey}`, strategy: 'year_plus_1', priority: 8 },
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear - 2}&apikey=${apiKey}`, strategy: 'year_minus_2', priority: 6 },
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear + 2}&apikey=${apiKey}`, strategy: 'year_plus_2', priority: 6 },
    
    // 3. Title only search (will validate year later)
    { url: `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${apiKey}`, strategy: 'title_only', priority: 4 },
    
    // 4. Try IMDB ID format
    { url: `http://www.omdbapi.com/?i=tt${String(movieId).padStart(7, '0')}&apikey=${apiKey}`, strategy: 'imdb_id', priority: 5 }
  ]
  
  let bestMatch = null
  let bestScore = 0
  
  for (const attempt of searchAttempts) {
    try {
      console.log(`Trying OMDB strategy "${attempt.strategy}": ${attempt.url}`)
      const response = await fetchWithTimeout(attempt.url, 8000)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data && data.Response !== 'False' && data.Title) {
          const score = calculateMatchScore(data, movieTitle, movieYear, attempt.strategy, attempt.priority)
          console.log(`OMDB: Found "${data.Title}" (${data.Year}) - Score: ${score}`)
          
          if (score > bestScore) {
            bestMatch = data
            bestScore = score
          }
          
          // If we find a very high confidence match, use it immediately
          if (score >= 9) {
            console.log(`High confidence match found with score ${score}, using immediately`)
            break
          }
        } else {
          console.log(`OMDB strategy "${attempt.strategy}": ${data?.Error || 'No valid data'}`)
        }
      }
    } catch (error) {
      console.log(`OMDB strategy "${attempt.strategy}" failed: ${error.message}`)
    }
  }
  
  if (bestMatch) {
    console.log(`Best OMDB match: "${bestMatch.Title}" (${bestMatch.Year}) with score ${bestScore}`)
  }
  
  return bestMatch
}

// Enhanced TMDB matching with search fallback
async function findBestTmdbMatch(movieTitle: string, movieYear: number, movieId: number, apiKey: string, fetchWithTimeout: Function): Promise<any> {
  console.log(`Enhanced TMDB search for: "${movieTitle}" (${movieYear}) - ID: ${movieId}`)
  
  // Try direct ID lookup first
  try {
    const directUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`
    const directResponse = await fetchWithTimeout(directUrl, 5000)
    
    if (directResponse.ok) {
      const directData = await directResponse.json()
      
      if (directData && !directData.status_code) {
        const releaseYear = directData.release_date ? parseInt(directData.release_date.substring(0, 4)) : null
        
        // Validate that this is actually the right movie
        if (releaseYear && Math.abs(releaseYear - movieYear) <= 2) {
          console.log(`TMDB: Direct ID match validated - "${directData.title}" (${releaseYear})`)
          return directData
        } else {
          console.log(`TMDB: Direct ID year mismatch - expected ${movieYear}, got ${releaseYear}`)
        }
      }
    }
  } catch (error) {
    console.log(`TMDB direct lookup failed: ${error.message}`)
  }
  
  // Fallback to search API
  try {
    console.log('TMDB: Falling back to search API')
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movieTitle)}`
    const searchResponse = await fetchWithTimeout(searchUrl, 5000)
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      
      if (searchData && searchData.results && searchData.results.length > 0) {
        let bestMatch = null
        let bestScore = 0
        
        for (const result of searchData.results.slice(0, 5)) { // Check top 5 results
          const releaseYear = result.release_date ? parseInt(result.release_date.substring(0, 4)) : null
          const score = calculateTmdbMatchScore(result, movieTitle, movieYear)
          
          console.log(`TMDB search result: "${result.title}" (${releaseYear}) - Score: ${score}`)
          
          if (score > bestScore) {
            bestMatch = result
            bestScore = score
          }
        }
        
        if (bestMatch && bestScore >= 6) {
          // Get full details for the best match
          const detailUrl = `https://api.themoviedb.org/3/movie/${bestMatch.id}?api_key=${apiKey}`
          const detailResponse = await fetchWithTimeout(detailUrl, 5000)
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            console.log(`TMDB: Using search result "${detailData.title}" with score ${bestScore}`)
            return detailData
          }
        }
      }
    }
  } catch (error) {
    console.log(`TMDB search failed: ${error.message}`)
  }
  
  return null
}

// Calculate match score for OMDB results
function calculateMatchScore(data: any, expectedTitle: string, expectedYear: number, strategy: string, basePriority: number): number {
  let score = basePriority
  
  // Title similarity (fuzzy matching)
  const titleSimilarity = calculateTitleSimilarity(data.Title, expectedTitle)
  score += titleSimilarity * 2
  
  // Year proximity
  if (data.Year && !isNaN(parseInt(data.Year))) {
    const yearDiff = Math.abs(parseInt(data.Year) - expectedYear)
    if (yearDiff === 0) score += 3
    else if (yearDiff === 1) score += 2
    else if (yearDiff === 2) score += 1
    else if (yearDiff > 5) score -= 2
  }
  
  // Type preference (prefer movies over TV)
  if (data.Type === 'movie') score += 1
  else if (data.Type === 'series') score -= 1
  
  // Prefer theatrical releases over TV movies
  if (data.Genre && !data.Genre.toLowerCase().includes('tv movie')) score += 0.5
  
  return Math.max(0, score)
}

// Calculate match score for TMDB results
function calculateTmdbMatchScore(result: any, expectedTitle: string, expectedYear: number): number {
  let score = 5 // Base score
  
  // Title similarity
  const titleSimilarity = calculateTitleSimilarity(result.title, expectedTitle)
  score += titleSimilarity * 3
  
  // Year proximity
  if (result.release_date) {
    const releaseYear = parseInt(result.release_date.substring(0, 4))
    const yearDiff = Math.abs(releaseYear - expectedYear)
    if (yearDiff === 0) score += 4
    else if (yearDiff === 1) score += 3
    else if (yearDiff === 2) score += 2
    else if (yearDiff > 5) score -= 3
  }
  
  // Popularity bonus (more popular movies are more likely to be correct)
  if (result.popularity && result.popularity > 10) score += 1
  if (result.popularity && result.popularity > 50) score += 1
  
  // Vote count bonus (more votes = more established movie)
  if (result.vote_count && result.vote_count > 100) score += 0.5
  if (result.vote_count && result.vote_count > 1000) score += 0.5
  
  return Math.max(0, score)
}

// Simple title similarity calculation (Levenshtein-inspired)
function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '').trim()
  
  if (t1 === t2) return 5
  
  // Check if one title contains the other
  if (t1.includes(t2) || t2.includes(t1)) return 4
  
  // Simple word overlap calculation
  const words1 = t1.split(/\s+/)
  const words2 = t2.split(/\s+/)
  const overlap = words1.filter(word => words2.includes(word)).length
  const totalWords = Math.max(words1.length, words2.length)
  
  return (overlap / totalWords) * 3
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
