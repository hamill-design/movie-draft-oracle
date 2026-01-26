
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
      letterboxdRating: null,
      oscarStatus: 'none',
      posterPath: null,
      movieGenre: null
    }

    // Simple timeout helper with optional headers
    const fetchWithTimeout = async (url: string, timeoutMs = 5000, headers?: Record<string, string>) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      
      try {
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: headers
        })
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

    // Fetch Letterboxd rating (optional - won't fail if unavailable)
    console.log('=== STARTING LETTERBOXD FETCH ===')
    try {
      console.log('Fetching Letterboxd rating...')
      console.log(`Movie title: ${movieTitle}, Year: ${movieYear}`)
      
      // Generate slug from title (Letterboxd format: lowercase, hyphens, no special chars)
      // Use TMDB title if available for better matching
      const titleToUse = tmdbData?.title || movieTitle
      
      const slug = titleToUse.toLowerCase()
        .replace(/&/g, 'and')          // Replace & with 'and'
        .replace(/\s+/g, '-')           // Spaces to hyphens
        .replace(/[':.,!?]/g, '')       // Remove common punctuation
        .replace(/[^a-z0-9-]/g, '')     // Remove any other non-alphanumeric (except hyphens)
        .replace(/-+/g, '-')            // Multiple hyphens to single
        .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
      
      // Try to fetch Letterboxd page with proper headers
      const letterboxdUrl = `https://letterboxd.com/film/${slug}/`
      console.log(`Letterboxd URL: ${letterboxdUrl}`)
      
      const letterboxdHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
      
      const response = await fetchWithTimeout(letterboxdUrl, 8000, letterboxdHeaders)
      
      if (response.ok) {
        const html = await response.text()
        
        // Parse rating from HTML
        // Letterboxd stores average rating in various places
        let rating: number | null = null
        
        // Method 1: Try Twitter meta tag (most reliable: "4.18 out of 5")
        const twitterMetaMatch = html.match(/<meta[^>]*name="twitter:data2"[^>]*content="([\d.]+)\s+out of 5"/i)
        if (twitterMetaMatch) {
          rating = parseFloat(twitterMetaMatch[1])
          console.log(`Letterboxd: Found rating via Twitter meta tag: ${rating}`)
        } else {
          // Method 2: Try data-average-rating attribute
          const dataRatingMatch = html.match(/data-average-rating="([\d.]+)"/)
          if (dataRatingMatch) {
            rating = parseFloat(dataRatingMatch[1])
            console.log(`Letterboxd: Found rating via data attribute: ${rating}`)
          } else {
            // Method 3: Try JSON-LD structured data
            const jsonLdMatch = html.match(/"ratingValue":\s*([\d.]+)/)
            if (jsonLdMatch) {
              rating = parseFloat(jsonLdMatch[1])
              console.log(`Letterboxd: Found rating via JSON-LD: ${rating}`)
            } else {
              // Method 4: Try to find "X.XX out of 5" pattern anywhere
              const outOfFiveMatch = html.match(/([\d.]+)\s+out of 5/i)
              if (outOfFiveMatch) {
                rating = parseFloat(outOfFiveMatch[1])
                console.log(`Letterboxd: Found rating via "out of 5" pattern: ${rating}`)
              } else {
                // Method 5: Try to find rating in script tags or data attributes
                const scriptRatingMatch = html.match(/averageRating["\s:]+([\d.]+)/i)
                if (scriptRatingMatch) {
                  rating = parseFloat(scriptRatingMatch[1])
                  console.log(`Letterboxd: Found rating via script tag: ${rating}`)
                } else {
                  // Method 6: Try to find rating in itemprop
                  const itempropMatch = html.match(/itemprop="ratingValue"[^>]*>([\d.]+)</i)
                  if (itempropMatch) {
                    rating = parseFloat(itempropMatch[1])
                    console.log(`Letterboxd: Found rating via itemprop: ${rating}`)
                  }
                }
              }
            }
          }
        }
        
        if (rating !== null && rating >= 0 && rating <= 5) {
          enrichmentData.letterboxdRating = rating
          console.log(`Letterboxd: ${rating}/5`)
        } else {
          console.log('Letterboxd: Rating not found or invalid in HTML')
          // If slug didn't work and we have TMDB data, try alternative slug generation
          if (tmdbData && !rating) {
            console.log('Letterboxd: Trying alternative slug from TMDB original title...')
            const altSlug = (tmdbData.original_title || tmdbData.title || movieTitle).toLowerCase()
              .replace(/&/g, 'and')
              .replace(/\s+/g, '-')
              .replace(/[':.,!?]/g, '')
              .replace(/[^a-z0-9-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
            
            if (altSlug !== slug) {
              try {
                const altUrl = `https://letterboxd.com/film/${altSlug}/`
                console.log(`Letterboxd: Trying alternative URL: ${altUrl}`)
                const altResponse = await fetchWithTimeout(altUrl, 8000, letterboxdHeaders)
                
                if (altResponse.ok) {
                  const altHtml = await altResponse.text()
                  const altTwitterMatch = altHtml.match(/<meta[^>]*name="twitter:data2"[^>]*content="([\d.]+)\s+out of 5"/i)
                  if (altTwitterMatch) {
                    rating = parseFloat(altTwitterMatch[1])
                    if (rating >= 0 && rating <= 5) {
                      enrichmentData.letterboxdRating = rating
                      console.log(`Letterboxd: Found rating via alternative slug: ${rating}/5`)
                    }
                  }
                }
              } catch (altError) {
                console.log(`Letterboxd: Alternative slug attempt failed: ${altError.message}`)
              }
            }
          }
        }
      } else {
        console.log(`Letterboxd: HTTP ${response.status} - Page not found or inaccessible`)
        // If 404 and we have TMDB data, try alternative slug
        if (response.status === 404 && tmdbData) {
          console.log('Letterboxd: Trying alternative slug from TMDB original title...')
          const altSlug = (tmdbData.original_title || tmdbData.title || movieTitle).toLowerCase()
            .replace(/&/g, 'and')
            .replace(/\s+/g, '-')
            .replace(/[':.,!?]/g, '')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
          
          if (altSlug !== slug) {
            try {
              const altUrl = `https://letterboxd.com/film/${altSlug}/`
              console.log(`Letterboxd: Trying alternative URL: ${altUrl}`)
              const altResponse = await fetchWithTimeout(altUrl, 8000, letterboxdHeaders)
              
              if (altResponse.ok) {
                const altHtml = await altResponse.text()
                const altTwitterMatch = altHtml.match(/<meta[^>]*name="twitter:data2"[^>]*content="([\d.]+)\s+out of 5"/i)
                if (altTwitterMatch) {
                  const rating = parseFloat(altTwitterMatch[1])
                  if (rating >= 0 && rating <= 5) {
                    enrichmentData.letterboxdRating = rating
                    console.log(`Letterboxd: Found rating via alternative slug: ${rating}/5`)
                  }
                }
              }
            } catch (altError) {
              console.log(`Letterboxd: Alternative slug attempt failed: ${altError.message}`)
            }
          }
        }
      }
    } catch (error) {
      console.log(`Letterboxd rating error: ${error.message}`)
      // Don't fail the whole enrichment if Letterboxd fails
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
    
    if (enrichmentData.letterboxdRating !== null && typeof enrichmentData.letterboxdRating === 'number') {
      updateData.letterboxd_rating = enrichmentData.letterboxdRating
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
    console.log('=== ENRICHMENT DATA SUMMARY ===')
    console.log(`Letterboxd Rating: ${enrichmentData.letterboxdRating || 'null'}`)
    console.log(`IMDB: ${enrichmentData.imdbRating || 'null'}`)
    console.log(`RT Critics: ${enrichmentData.rtCriticsScore || 'null'}`)
    console.log(`Metacritic: ${enrichmentData.metacriticScore || 'null'}`)
    console.log(`Final Score: ${finalScore}`)

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
  // Box Office Score - Hybrid ROI-based formula
  // Linear scaling for 0-100% ROI (0-60 points), logarithmic for >100% ROI (60-100 points)
  let boxOfficeScore = 0
  if (data.budget && data.revenue && data.budget > 0) {
    const profit = data.revenue - data.budget
    if (profit <= 0) {
      boxOfficeScore = 0 // Flops get 0
    } else {
      const roiPercent = (profit / data.budget) * 100
      if (roiPercent <= 100) {
        // Linear scaling: 0-100% ROI → 0-60 points (2x return = 60 points)
        boxOfficeScore = 60 * (roiPercent / 100)
      } else {
        // Logarithmic scaling: >100% ROI → 60-100 points (diminishing returns)
        boxOfficeScore = 60 + 40 * (1 - Math.exp(-(roiPercent - 100) / 200))
      }
    }
  }

  // Convert scores to 0-100 scale
  const rtCriticsScore = data.rtCriticsScore || 0
  const metacriticScore = data.metacriticScore || 0
  const imdbScore = data.imdbRating ? (data.imdbRating / 10) * 100 : 0
  const letterboxdScore = data.letterboxdRating ? (data.letterboxdRating / 5) * 100 : 0

  // Layer 1: Calculate Critics Score (Internal Consensus)
  let criticsRawAvg = 0
  let criticsScore = 0
  if (rtCriticsScore && metacriticScore) {
    criticsRawAvg = (rtCriticsScore + metacriticScore) / 2
    const criticsInternalDiff = Math.abs(rtCriticsScore - metacriticScore)
    const criticsInternalModifier = Math.max(0, 1 - (criticsInternalDiff / 200))
    criticsScore = criticsRawAvg * criticsInternalModifier
  } else if (rtCriticsScore) {
    criticsRawAvg = rtCriticsScore
    criticsScore = rtCriticsScore
  } else if (metacriticScore) {
    criticsRawAvg = metacriticScore
    criticsScore = metacriticScore
  }

  // Layer 2: Calculate Audience Score (Internal Consensus)
  let audienceRawAvg = 0
  let audienceScore = 0
  if (imdbScore && letterboxdScore) {
    audienceRawAvg = (imdbScore + letterboxdScore) / 2
    const audienceInternalDiff = Math.abs(imdbScore - letterboxdScore)
    const audienceInternalModifier = Math.max(0, 1 - (audienceInternalDiff / 200))
    audienceScore = audienceRawAvg * audienceInternalModifier
  } else if (imdbScore) {
    audienceRawAvg = imdbScore
    audienceScore = imdbScore
  } else if (letterboxdScore) {
    audienceRawAvg = letterboxdScore
    audienceScore = letterboxdScore
  }

  // Layer 3: Calculate Final Critical Score (Cross-Category Consensus)
  let criticalScore = 0
  if (criticsRawAvg > 0 && audienceRawAvg > 0) {
    // Use RAW averages for consensus calculation
    const criticsAudienceDiff = Math.abs(criticsRawAvg - audienceRawAvg)
    const consensusModifier = Math.max(0, 1 - (criticsAudienceDiff / 200))
    
    // Weighted average of penalized scores (50/50)
    const weightedAvg = (criticsScore * 0.5) + (audienceScore * 0.5)
    criticalScore = weightedAvg * consensusModifier
  } else if (criticsScore > 0) {
    criticalScore = criticsScore
  } else if (audienceScore > 0) {
    criticalScore = audienceScore
  }

  // Fixed weights: 20% Box Office, 80% Critical Score
  let boxOfficeWeight = 0.20
  let criticalWeight = 0.80
  
  if (boxOfficeScore > 0 && criticalScore > 0) {
    // Both available: use fixed 20/80 split
    boxOfficeWeight = 0.20
    criticalWeight = 0.80
  } else if (boxOfficeScore > 0) {
    // Only Box Office available
    boxOfficeWeight = 1.0
    criticalWeight = 0
  } else if (criticalScore > 0) {
    // Only Critical Score available
    boxOfficeWeight = 0
    criticalWeight = 1.0
  }

  // Calculate final average with fixed weights
  let averageScore = 0
  if (boxOfficeScore > 0 && criticalScore > 0) {
    averageScore = (boxOfficeScore * boxOfficeWeight) + (criticalScore * criticalWeight)
  } else if (boxOfficeScore > 0) {
    averageScore = boxOfficeScore
  } else if (criticalScore > 0) {
    averageScore = criticalScore
  }

  // Oscar Bonus - Added after averaging (+3 for nomination, +6 for winner)
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 6
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 3
  }

  // Final score is the average plus Oscar bonus
  const finalScore = averageScore + oscarBonus
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
