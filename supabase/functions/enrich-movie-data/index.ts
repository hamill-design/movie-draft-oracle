
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

    console.log(`Enriching data for movie: ${movieTitle} (${movieYear})`)

    let enrichmentData: MovieEnrichmentData = {}

    // Fetch from OMDB API
    const omdbApiKey = Deno.env.get('OMDB_API_KEY')
    if (omdbApiKey) {
      try {
        // Search by title and year for better accuracy
        const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${omdbApiKey}&plot=short`
        
        console.log(`Fetching from OMDB: ${omdbUrl}`)
        const omdbResponse = await fetch(omdbUrl)
        const omdbData = await omdbResponse.json()

        if (omdbData.Response !== 'False') {
          console.log('OMDB Data received:', JSON.stringify(omdbData, null, 2))
          
          // Extract Rotten Tomatoes scores
          const ratings = omdbData.Ratings || []
          const rtCritics = ratings.find((r: any) => r.Source === 'Rotten Tomatoes')
          
          if (rtCritics?.Value) {
            const criticsScore = parseInt(rtCritics.Value.replace('%', ''))
            if (!isNaN(criticsScore)) {
              enrichmentData.rtCriticsScore = criticsScore
              console.log(`RT Critics Score: ${criticsScore}`)
            }
          }

          // Extract IMDB rating
          if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const imdbRating = parseFloat(omdbData.imdbRating)
            if (!isNaN(imdbRating)) {
              enrichmentData.imdbRating = imdbRating
              console.log(`IMDB Rating: ${imdbRating}`)
            }
          }

          // Check for Oscar wins/nominations
          if (omdbData.Awards) {
            const awards = omdbData.Awards.toLowerCase()
            if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'winner'
              console.log('Oscar Status: winner')
            } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'nominee'
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

    // Fetch budget/revenue from TMDB (using existing fetch-movies function)
    try {
      const tmdbResponse = await supabaseClient.functions.invoke('fetch-movies', {
        body: {
          category: 'details',
          movieId: movieId
        }
      })

      console.log('TMDB Response:', JSON.stringify(tmdbResponse, null, 2))

      if (tmdbResponse.data?.budget) {
        enrichmentData.budget = tmdbResponse.data.budget
        console.log(`Budget: ${enrichmentData.budget}`)
      }
      if (tmdbResponse.data?.revenue) {
        enrichmentData.revenue = tmdbResponse.data.revenue
        console.log(`Revenue: ${enrichmentData.revenue}`)
      }
    } catch (tmdbError) {
      console.error('Error fetching from TMDB:', tmdbError)
    }

    console.log('Final enrichment data:', JSON.stringify(enrichmentData, null, 2))

    // Calculate final score
    const finalScore = calculateFinalScore(enrichmentData)
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
        scoring_data_complete: true
      })
      .eq('movie_id', movieId)

    if (updateError) {
      throw updateError
    }

    console.log(`Successfully enriched data for ${movieTitle} with score: ${finalScore}`)

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
    const boxOfficeScore = Math.min(Math.max(roi, 0), 100) // Cap at 100, floor at 0
    totalScore += boxOfficeScore * 0.3
    totalWeight += 0.3
    console.log(`Box Office Score: ${boxOfficeScore} (ROI: ${roi}%)`)
  } else {
    console.log('No valid budget/revenue data for box office score')
  }

  // RT Critics Score (25% weight)
  if (data.rtCriticsScore) {
    totalScore += data.rtCriticsScore * 0.25
    totalWeight += 0.25
    console.log(`RT Critics Score: ${data.rtCriticsScore}`)
  } else {
    console.log('No RT Critics score available')
  }

  // RT Audience Score (25% weight) - For now, we'll skip this since OMDB doesn't provide it easily
  if (data.rtAudienceScore) {
    totalScore += data.rtAudienceScore * 0.25
    totalWeight += 0.25
    console.log(`RT Audience Score: ${data.rtAudienceScore}`)
  } else {
    console.log('No RT Audience score available')
  }

  // IMDB Score (10% weight)
  if (data.imdbRating) {
    const imdbScore = (data.imdbRating / 10) * 100
    totalScore += imdbScore * 0.1
    totalWeight += 0.1
    console.log(`IMDB Score: ${imdbScore} (from rating: ${data.imdbRating})`)
  } else {
    console.log('No IMDB rating available')
  }

  // Oscar Bonus (10% weight)
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 20
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 10
  }
  totalScore += oscarBonus * 0.1
  totalWeight += 0.1
  console.log(`Oscar Bonus: ${oscarBonus} (status: ${data.oscarStatus})`)

  console.log(`Total weighted score: ${totalScore}, Total weight: ${totalWeight}`)

  // If we don't have all data, normalize by available weight
  if (totalWeight > 0) {
    const finalScore = (totalScore / totalWeight) * 100
    console.log(`Final normalized score: ${finalScore}`)
    return Math.round(finalScore * 100) / 100
  }

  console.log('No scoring data available, returning 0')
  return 0
}
