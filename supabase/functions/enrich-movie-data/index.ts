
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MovieEnrichmentData {
  budget?: number
  revenue?: number
  rtCriticsScore?: number
  rtAudienceScore?: number
  imdbRating?: number
  oscarStatus?: 'none' | 'nominee' | 'winner'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { movieId, movieTitle, movieYear } = await req.json()
    
    if (!movieId || !movieTitle) {
      throw new Error('Missing required parameters: movieId and movieTitle')
    }

    console.log(`=== ENRICHING MOVIE DATA ===`)
    console.log(`Movie: ${movieTitle} (${movieYear}) - Movie ID: ${movieId}`)

    let enrichmentData: MovieEnrichmentData = {}
    let hasAnyData = false

    // Check API keys first
    const omdbApiKey = Deno.env.get('OMDB')
    const tmdbApiKey = Deno.env.get('TMDB')
    
    console.log(`OMDB API Key configured: ${omdbApiKey ? 'YES' : 'NO'}`)
    console.log(`TMDB API Key configured: ${tmdbApiKey ? 'YES' : 'NO'}`)

    // Set timeout for API calls
    const API_TIMEOUT = 8000 // 8 seconds max per API call

    // Fetch from OMDB API for IMDB and RT data
    if (omdbApiKey) {
      try {
        console.log(`--- FETCHING FROM OMDB ---`)
        
        const cleanTitle = movieTitle.replace(/[^\w\s\-\.]/g, '').trim()
        
        // Try primary search with timeout
        const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${omdbApiKey}&plot=short`
        console.log(`OMDB URL: ${omdbUrl}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
        
        try {
          const omdbResponse = await fetch(omdbUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'MovieApp/1.0' },
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (omdbResponse.ok) {
            const responseText = await omdbResponse.text()
            console.log(`OMDB Response: ${responseText.substring(0, 200)}...`)
            
            const omdbData = JSON.parse(responseText)
            
            if (omdbData && omdbData.Response !== 'False' && omdbData.Title) {
              console.log(`✓ OMDB data found for "${omdbData.Title}" (${omdbData.Year})`)
              
              // Extract IMDB rating
              if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
                const imdbRating = parseFloat(omdbData.imdbRating)
                if (!isNaN(imdbRating) && imdbRating > 0) {
                  enrichmentData.imdbRating = imdbRating
                  hasAnyData = true
                  console.log(`✓ IMDB Rating: ${imdbRating}`)
                }
              }

              // Extract Rotten Tomatoes scores
              if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
                for (const rating of omdbData.Ratings) {
                  if (rating.Source === 'Rotten Tomatoes') {
                    const scoreMatch = rating.Value.match(/(\d+)%/)
                    if (scoreMatch) {
                      const criticsScore = parseInt(scoreMatch[1])
                      if (!isNaN(criticsScore)) {
                        enrichmentData.rtCriticsScore = criticsScore
                        hasAnyData = true
                        console.log(`✓ RT Critics Score: ${criticsScore}%`)
                      }
                    }
                  }
                }
              }

              // Check for Oscar status
              if (omdbData.Awards) {
                const awards = omdbData.Awards.toLowerCase()
                if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
                  enrichmentData.oscarStatus = 'winner'
                } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
                  enrichmentData.oscarStatus = 'nominee'
                } else {
                  enrichmentData.oscarStatus = 'none'
                }
                hasAnyData = true
                console.log(`✓ Oscar Status: ${enrichmentData.oscarStatus}`)
              } else {
                enrichmentData.oscarStatus = 'none'
              }
            } else {
              console.log(`✗ OMDB: No valid data found - ${omdbData.Error || 'Unknown error'}`)
              enrichmentData.oscarStatus = 'none'
            }
          } else {
            console.log(`✗ OMDB HTTP error: ${omdbResponse.status}`)
            enrichmentData.oscarStatus = 'none'
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          console.log(`✗ OMDB fetch error: ${fetchError.message}`)
          enrichmentData.oscarStatus = 'none'
        }
      } catch (omdbError) {
        console.error('❌ OMDB Error:', omdbError.message)
        enrichmentData.oscarStatus = 'none'
      }
    } else {
      console.log('❌ OMDB API key not configured')
      enrichmentData.oscarStatus = 'none'
    }

    // Fetch budget/revenue from TMDB with timeout
    if (tmdbApiKey && movieId) {
      try {
        console.log(`--- FETCHING FROM TMDB ---`)
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
        console.log(`TMDB URL: ${tmdbUrl}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
        
        try {
          const tmdbResponse = await fetch(tmdbUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'MovieApp/1.0' },
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (tmdbResponse.ok) {
            const responseText = await tmdbResponse.text()
            console.log(`TMDB Response: ${responseText.substring(0, 200)}...`)

            const tmdbData = JSON.parse(responseText)

            if (tmdbData && !tmdbData.status_code) {
              if (tmdbData.budget && tmdbData.budget > 0) {
                enrichmentData.budget = tmdbData.budget
                hasAnyData = true
                console.log(`✓ Budget: $${enrichmentData.budget.toLocaleString()}`)
              }
              
              if (tmdbData.revenue && tmdbData.revenue > 0) {
                enrichmentData.revenue = tmdbData.revenue
                hasAnyData = true
                console.log(`✓ Revenue: $${enrichmentData.revenue.toLocaleString()}`)
              }
            } else {
              console.log(`✗ TMDB API error: ${tmdbData.status_message || 'Unknown error'}`)
            }
          } else {
            console.log(`✗ TMDB HTTP error: ${tmdbResponse.status}`)
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          console.log(`✗ TMDB fetch error: ${fetchError.message}`)
        }
      } catch (tmdbError) {
        console.error('❌ TMDB Error:', tmdbError.message)
      }
    } else {
      console.log('❌ TMDB API key not configured or no movie ID')
    }

    console.log(`--- FINAL ENRICHMENT DATA ---`)
    console.log(JSON.stringify(enrichmentData, null, 2))

    // Calculate final score
    const finalScore = calculateFinalScore(enrichmentData)
    console.log(`Calculated final score: ${finalScore}`)

    // Mark as complete if we have any meaningful data
    const shouldMarkComplete = hasAnyData || (enrichmentData.oscarStatus !== undefined)

    console.log(`--- UPDATING DATABASE ---`)
    console.log(`Should mark complete: ${shouldMarkComplete}`)

    // Update the draft_picks table
    const { error: updateError } = await supabaseClient
      .from('draft_picks')
      .update({
        movie_budget: enrichmentData.budget || null,
        movie_revenue: enrichmentData.revenue || null,
        rt_critics_score: enrichmentData.rtCriticsScore || null,
        rt_audience_score: enrichmentData.rtAudienceScore || null,
        imdb_rating: enrichmentData.imdbRating || null,
        oscar_status: enrichmentData.oscarStatus || 'none',
        calculated_score: finalScore,
        scoring_data_complete: shouldMarkComplete
      })
      .eq('movie_id', movieId)

    if (updateError) {
      console.error('❌ Database update error:', updateError)
      throw updateError
    }

    console.log(`✅ Successfully updated database for ${movieTitle}`)

    return new Response(
      JSON.stringify({
        success: true,
        enrichmentData: {
          ...enrichmentData,
          calculatedScore: finalScore
        },
        hasData: hasAnyData,
        markedComplete: shouldMarkComplete
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error enriching movie data:', error)
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function calculateFinalScore(data: MovieEnrichmentData): number {
  let totalScore = 0
  let totalWeight = 0

  console.log('--- CALCULATING SCORE ---')

  // Box Office Score (30% weight)
  if (data.budget && data.revenue && data.budget > 0) {
    const roi = ((data.revenue - data.budget) / data.budget) * 100
    const boxOfficeScore = Math.min(Math.max(roi, 0), 100)
    totalScore += boxOfficeScore * 0.3
    totalWeight += 0.3
    console.log(`Box Office Score: ${boxOfficeScore.toFixed(2)} (ROI: ${roi.toFixed(2)}%)`)
  }

  // RT Critics Score (25% weight)
  if (data.rtCriticsScore && data.rtCriticsScore > 0) {
    totalScore += data.rtCriticsScore * 0.25
    totalWeight += 0.25
    console.log(`RT Critics Score: ${data.rtCriticsScore}`)
  }

  // RT Audience Score (25% weight)
  if (data.rtAudienceScore && data.rtAudienceScore > 0) {
    totalScore += data.rtAudienceScore * 0.25
    totalWeight += 0.25
    console.log(`RT Audience Score: ${data.rtAudienceScore}`)
  }

  // IMDB Score (10% weight)
  if (data.imdbRating && data.imdbRating > 0) {
    const imdbScore = (data.imdbRating / 10) * 100
    totalScore += imdbScore * 0.1
    totalWeight += 0.1
    console.log(`IMDB Score: ${imdbScore.toFixed(2)} (from rating: ${data.imdbRating})`)
  }

  // Oscar Bonus (10% weight)
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 100
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 50
  }
  totalScore += oscarBonus * 0.1
  totalWeight += 0.1
  console.log(`Oscar Bonus: ${oscarBonus} (status: ${data.oscarStatus})`)

  const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0
  console.log(`Final score: ${finalScore.toFixed(2)}`)
  
  return Math.round(finalScore * 100) / 100
}
