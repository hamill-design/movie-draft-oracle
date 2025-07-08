
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

    // Fetch from OMDB API
    if (omdbApiKey) {
      try {
        console.log(`--- FETCHING FROM OMDB ---`)
        
        // Clean the movie title for better search results
        const cleanTitle = movieTitle.replace(/[^\w\s]/g, '').trim()
        
        // Try different search strategies
        const searchStrategies = [
          `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&y=${movieYear}&apikey=${omdbApiKey}`,
          `http://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&y=${movieYear}&apikey=${omdbApiKey}`,
          `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${omdbApiKey}`,
          `http://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&apikey=${omdbApiKey}`
        ]
        
        let omdbData = null
        
        for (const [index, url] of searchStrategies.entries()) {
          console.log(`OMDB Strategy ${index + 1}: ${url}`)
          
          try {
            const omdbResponse = await fetch(url)
            const responseText = await omdbResponse.text()
            console.log(`OMDB Response Status: ${omdbResponse.status}`)
            console.log(`OMDB Response Text: ${responseText}`)
            
            if (omdbResponse.ok) {
              const data = JSON.parse(responseText)
              if (data && data.Response !== 'False') {
                omdbData = data
                console.log(`✓ OMDB Strategy ${index + 1} succeeded`)
                break
              } else {
                console.log(`✗ OMDB Strategy ${index + 1} failed: ${data.Error || 'No data found'}`)
              }
            } else {
              console.log(`✗ OMDB Strategy ${index + 1} HTTP error: ${omdbResponse.status}`)
            }
          } catch (strategyError) {
            console.log(`✗ OMDB Strategy ${index + 1} error:`, strategyError)
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        if (omdbData) {
          console.log(`--- PROCESSING OMDB DATA ---`)
          console.log(`Full OMDB Data:`, JSON.stringify(omdbData, null, 2))
          
          // Extract IMDB rating
          if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A' && omdbData.imdbRating !== '') {
            const imdbRating = parseFloat(omdbData.imdbRating)
            if (!isNaN(imdbRating) && imdbRating > 0) {
              enrichmentData.imdbRating = imdbRating
              hasAnyData = true
              console.log(`✓ IMDB Rating: ${imdbRating}`)
            } else {
              console.log(`✗ Invalid IMDB Rating: ${omdbData.imdbRating}`)
            }
          } else {
            console.log(`✗ No IMDB Rating found`)
          }

          // Extract Rotten Tomatoes scores
          if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
            console.log(`Processing ${omdbData.Ratings.length} ratings...`)
            
            for (const rating of omdbData.Ratings) {
              console.log(`Rating source: ${rating.Source}, value: ${rating.Value}`)
              
              if (rating.Source === 'Rotten Tomatoes') {
                const scoreMatch = rating.Value.match(/(\d+)%/)
                if (scoreMatch) {
                  const criticsScore = parseInt(scoreMatch[1])
                  if (!isNaN(criticsScore)) {
                    enrichmentData.rtCriticsScore = criticsScore
                    hasAnyData = true
                    console.log(`✓ RT Critics Score: ${criticsScore}`)
                  }
                } else {
                  console.log(`✗ Could not parse RT score: ${rating.Value}`)
                }
              }
            }
          } else {
            console.log(`✗ No ratings array found`)
          }

          // Check for Oscar wins/nominations
          if (omdbData.Awards) {
            const awards = omdbData.Awards.toLowerCase()
            console.log(`Awards: ${omdbData.Awards}`)
            if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'winner'
              console.log(`✓ Oscar Status: winner`)
            } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
              enrichmentData.oscarStatus = 'nominee'
              console.log(`✓ Oscar Status: nominee`)
            } else {
              enrichmentData.oscarStatus = 'none'
              console.log(`✓ Oscar Status: none`)
            }
            hasAnyData = true
          } else {
            enrichmentData.oscarStatus = 'none'
            console.log(`✓ Oscar Status: none (no awards data)`)
          }
        } else {
          console.log(`✗ No valid OMDB data found with any strategy`)
          enrichmentData.oscarStatus = 'none'
        }
      } catch (omdbError) {
        console.error('❌ OMDB Error:', omdbError)
        enrichmentData.oscarStatus = 'none'
      }
    } else {
      console.log('❌ OMDB API key not configured')
      enrichmentData.oscarStatus = 'none'
    }

    // Fetch budget/revenue from TMDB
    if (tmdbApiKey && movieId) {
      try {
        console.log(`--- FETCHING FROM TMDB ---`)
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
        console.log(`TMDB URL: ${tmdbUrl}`)
        
        const tmdbResponse = await fetch(tmdbUrl)
        const responseText = await tmdbResponse.text()
        console.log(`TMDB Response Status: ${tmdbResponse.status}`)
        console.log(`TMDB Response Text: ${responseText}`)

        if (tmdbResponse.ok) {
          const tmdbData = JSON.parse(responseText)
          console.log(`TMDB Data:`, JSON.stringify(tmdbData, null, 2))

          if (tmdbData && !tmdbData.status_code) {
            if (tmdbData.budget && tmdbData.budget > 0) {
              enrichmentData.budget = tmdbData.budget
              hasAnyData = true
              console.log(`✓ Budget: $${enrichmentData.budget.toLocaleString()}`)
            } else {
              console.log(`✗ No budget data`)
            }
            
            if (tmdbData.revenue && tmdbData.revenue > 0) {
              enrichmentData.revenue = tmdbData.revenue
              hasAnyData = true
              console.log(`✓ Revenue: $${enrichmentData.revenue.toLocaleString()}`)
            } else {
              console.log(`✗ No revenue data`)
            }
          } else {
            console.log(`✗ TMDB API error: ${tmdbData.status_message || 'Unknown error'}`)
          }
        } else {
          console.log(`✗ TMDB HTTP error: ${tmdbResponse.status}`)
        }
      } catch (tmdbError) {
        console.error('❌ TMDB Error:', tmdbError)
      }
    } else {
      console.log('❌ TMDB API key not configured or no movie ID')
    }

    console.log(`--- FINAL ENRICHMENT DATA ---`)
    console.log(JSON.stringify(enrichmentData, null, 2))
    console.log(`Has any data: ${hasAnyData}`)

    // Calculate final score
    const finalScore = calculateFinalScore(enrichmentData)
    console.log(`Calculated final score: ${finalScore}`)

    // Only mark as complete if we actually got some meaningful data
    const shouldMarkComplete = hasAnyData || (enrichmentData.oscarStatus !== undefined)

    console.log(`--- UPDATING DATABASE ---`)
    console.log(`Movie ID: ${movieId}`)
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
        markedComplete: shouldMarkComplete,
        debug: {
          omdbConfigured: !!omdbApiKey,
          tmdbConfigured: !!tmdbApiKey
        }
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
  console.log('Input data:', JSON.stringify(data, null, 2))

  // Box Office Score (30% weight)
  if (data.budget && data.revenue && data.budget > 0) {
    const roi = ((data.revenue - data.budget) / data.budget) * 100
    const boxOfficeScore = Math.min(Math.max(roi, 0), 100)
    totalScore += boxOfficeScore * 0.3
    totalWeight += 0.3
    console.log(`Box Office Score: ${boxOfficeScore.toFixed(2)} (ROI: ${roi.toFixed(2)}%) - Weight: 30%`)
  } else {
    console.log(`Box Office Score: MISSING - no budget/revenue data`)
  }

  // RT Critics Score (25% weight)
  if (data.rtCriticsScore && data.rtCriticsScore > 0) {
    totalScore += data.rtCriticsScore * 0.25
    totalWeight += 0.25
    console.log(`RT Critics Score: ${data.rtCriticsScore} - Weight: 25%`)
  } else {
    console.log(`RT Critics Score: MISSING`)
  }

  // RT Audience Score (25% weight)
  if (data.rtAudienceScore && data.rtAudienceScore > 0) {
    totalScore += data.rtAudienceScore * 0.25
    totalWeight += 0.25
    console.log(`RT Audience Score: ${data.rtAudienceScore} - Weight: 25%`)
  } else {
    console.log(`RT Audience Score: MISSING`)
  }

  // IMDB Score (10% weight) - convert to 0-100 scale
  if (data.imdbRating && data.imdbRating > 0) {
    const imdbScore = (data.imdbRating / 10) * 100
    totalScore += imdbScore * 0.1
    totalWeight += 0.1
    console.log(`IMDB Score: ${imdbScore.toFixed(2)} (from rating: ${data.imdbRating}) - Weight: 10%`)
  } else {
    console.log(`IMDB Score: MISSING`)
  }

  // Oscar Bonus (10% weight)
  let oscarBonus = 0
  if (data.oscarStatus === 'winner') {
    oscarBonus = 100 // Full score for winners
  } else if (data.oscarStatus === 'nominee') {
    oscarBonus = 50 // Half score for nominees
  } else {
    oscarBonus = 0 // No bonus for no awards
  }
  totalScore += oscarBonus * 0.1
  totalWeight += 0.1
  console.log(`Oscar Bonus: ${oscarBonus} (status: ${data.oscarStatus}) - Weight: 10%`)

  console.log(`Total weighted score: ${totalScore.toFixed(2)}, Total weight: ${totalWeight.toFixed(2)}`)

  // Calculate final score - if we have any data, calculate based on available components
  const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0
  console.log(`Final score: ${finalScore.toFixed(2)}`)
  
  return Math.round(finalScore * 100) / 100
}
