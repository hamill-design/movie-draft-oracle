
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

    console.log(`Enriching data for movie: ${movieTitle} (${movieYear}) - Movie ID: ${movieId}`)

    let enrichmentData: MovieEnrichmentData = {}
    let hasAnyData = false

    // Fetch from OMDB API
    const omdbApiKey = Deno.env.get('OMDB_API_KEY')
    if (omdbApiKey) {
      try {
        // Search by title and year for better accuracy
        const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${omdbApiKey}&plot=short`
        
        console.log(`Fetching from OMDB: ${omdbUrl}`)
        const omdbResponse = await fetch(omdbUrl)
        const omdbData = await omdbResponse.json()

        console.log(`OMDB Response for ${movieTitle}:`, JSON.stringify(omdbData, null, 2))

        if (omdbData.Response !== 'False') {          
          // Extract Rotten Tomatoes scores
          const ratings = omdbData.Ratings || []
          console.log('Available ratings:', ratings)
          
          const rtCritics = ratings.find((r: any) => r.Source === 'Rotten Tomatoes')
          if (rtCritics?.Value) {
            const criticsScore = parseInt(rtCritics.Value.replace('%', ''))
            if (!isNaN(criticsScore)) {
              enrichmentData.rtCriticsScore = criticsScore
              hasAnyData = true
              console.log(`RT Critics Score: ${criticsScore}`)
            }
          }

          // Extract IMDB rating
          if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const imdbRating = parseFloat(omdbData.imdbRating)
            if (!isNaN(imdbRating)) {
              enrichmentData.imdbRating = imdbRating
              hasAnyData = true
              console.log(`IMDB Rating: ${imdbRating}`)
            }
          }

          // Check for Oscar wins/nominations
          if (omdbData.Awards) {
            const awards = omdbData.Awards.toLowerCase()
            console.log(`Awards for ${movieTitle}: ${omdbData.Awards}`)
            if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'winner'
              hasAnyData = true
              console.log('Oscar Status: winner')
            } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'nominee'
              hasAnyData = true
              console.log('Oscar Status: nominee')
            } else {
              enrichmentData.oscarStatus = 'none'
            }
          } else {
            enrichmentData.oscarStatus = 'none'
          }
        } else {
          console.log(`OMDB API error for ${movieTitle}: ${omdbData.Error}`)
          enrichmentData.oscarStatus = 'none'
        }
      } catch (omdbError) {
        console.error('Error fetching from OMDB:', omdbError)
        enrichmentData.oscarStatus = 'none'
      }
    } else {
      console.log('OMDB API key not configured')
      enrichmentData.oscarStatus = 'none'
    }

    // Fetch budget/revenue from TMDB
    const tmdbApiKey = Deno.env.get('TMDB')
    if (tmdbApiKey && movieId) {
      try {
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
        console.log(`Fetching from TMDB: ${tmdbUrl}`)
        
        const tmdbResponse = await fetch(tmdbUrl)
        const tmdbData = await tmdbResponse.json()

        console.log(`TMDB Response for ${movieTitle}:`, JSON.stringify(tmdbData, null, 2))

        if (tmdbData && !tmdbData.status_code) {
          if (tmdbData.budget && tmdbData.budget > 0) {
            enrichmentData.budget = tmdbData.budget
            hasAnyData = true
            console.log(`Budget: ${enrichmentData.budget}`)
          }
          if (tmdbData.revenue && tmdbData.revenue > 0) {
            enrichmentData.revenue = tmdbData.revenue
            hasAnyData = true
            console.log(`Revenue: ${enrichmentData.revenue}`)
          }
        } else {
          console.log(`TMDB API error for ${movieTitle}:`, tmdbData.status_message || 'Unknown error')
        }
      } catch (tmdbError) {
        console.error('Error fetching from TMDB:', tmdbError)
      }
    } else {
      console.log('TMDB API key not configured or no movie ID')
    }

    console.log('Final enrichment data:', JSON.stringify(enrichmentData, null, 2))
    console.log('Has any data:', hasAnyData)

    // Calculate final score only if we have some data
    const finalScore = hasAnyData ? calculateFinalScore(enrichmentData) : 0
    console.log(`Calculated final score: ${finalScore}`)

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
        scoring_data_complete: hasAnyData // Only mark as complete if we actually got some data
      })
      .eq('movie_id', movieId)

    if (updateError) {
      throw updateError
    }

    console.log(`Successfully enriched data for ${movieTitle} with score: ${finalScore}, hasData: ${hasAnyData}`)

    return new Response(
      JSON.stringify({
        success: true,
        enrichmentData: {
          ...enrichmentData,
          calculatedScore: finalScore
        },
        hasData: hasAnyData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error enriching movie data:', error)
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

  console.log('Calculating score with data:', JSON.stringify(data, null, 2))

  // Box Office Score (30% weight)
  if (data.budget && data.revenue && data.budget > 0) {
    const roi = ((data.revenue - data.budget) / data.budget) * 100
    const boxOfficeScore = Math.min(Math.max(roi, 0), 200) // Cap at 200%, floor at 0
    totalScore += boxOfficeScore * 0.3
    totalWeight += 0.3
    console.log(`Box Office Score: ${boxOfficeScore} (ROI: ${roi.toFixed(2)}%)`)
  } else {
    console.log('No valid budget/revenue data for box office score')
  }

  // RT Critics Score (25% weight)
  if (data.rtCriticsScore && data.rtCriticsScore > 0) {
    totalScore += data.rtCriticsScore * 0.25
    totalWeight += 0.25
    console.log(`RT Critics Score: ${data.rtCriticsScore}`)
  } else {
    console.log('No RT Critics score available')
  }

  // RT Audience Score (25% weight)
  if (data.rtAudienceScore && data.rtAudienceScore > 0) {
    totalScore += data.rtAudienceScore * 0.25
    totalWeight += 0.25
    console.log(`RT Audience Score: ${data.rtAudienceScore}`)
  } else {
    console.log('No RT Audience score available')
  }

  // IMDB Score (10% weight)
  if (data.imdbRating && data.imdbRating > 0) {
    const imdbScore = (data.imdbRating / 10) * 100
    totalScore += imdbScore * 0.1
    totalWeight += 0.1
    console.log(`IMDB Score: ${imdbScore.toFixed(2)} (from rating: ${data.imdbRating})`)
  } else {
    console.log('No IMDB rating available')
  }

  // Oscar Bonus (10% weight) - always included
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 100 // Full bonus for winners
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 50 // Half bonus for nominees
  }
  totalScore += oscarBonus * 0.1
  totalWeight += 0.1
  console.log(`Oscar Bonus: ${oscarBonus} (status: ${data.oscarStatus})`)

  console.log(`Total weighted score: ${totalScore.toFixed(2)}, Total weight: ${totalWeight.toFixed(2)}`)

  // Calculate final score - normalize by the total possible weight
  if (totalWeight > 0) {
    const finalScore = totalScore / totalWeight
    console.log(`Final normalized score: ${finalScore.toFixed(2)}`)
    return Math.round(finalScore * 100) / 100
  }

  console.log('No scoring data available, returning 0')
  return 0
}
