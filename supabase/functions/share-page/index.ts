import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const draftId = url.searchParams.get('draftId')
    
    if (!draftId) {
      return new Response('Draft ID required', { status: 400 })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch draft and picks data
    const [draftResponse, picksResponse] = await Promise.all([
      supabase
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .single(),
      supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', draftId)
        .order('calculated_score', { ascending: false })
    ])

    if (draftResponse.error || !draftResponse.data) {
      return new Response('Draft not found', { status: 404 })
    }

    const draft = draftResponse.data
    const picks = picksResponse.data || []

    // Calculate team scores
    const teamScores = draft.participants.map(participant => {
      const playerPicks = picks.filter(pick => pick.player_name === participant)
      const completedPicks = playerPicks.filter(pick => pick.scoring_data_complete)
      const totalScore = completedPicks.reduce((sum, pick) => sum + (pick.calculated_score || 0), 0)
      const averageScore = completedPicks.length > 0 ? totalScore / completedPicks.length : 0
      
      return {
        playerName: participant,
        averageScore,
        completedPicks: completedPicks.length,
        totalPicks: playerPicks.length
      }
    }).sort((a, b) => b.averageScore - a.averageScore)

    const winner = teamScores[0]
    const title = `${draft.title} - CineDraft Championship Results`
    
    // Generate the same rich description format as the frontend
    let description = winner 
      ? `🎬 The Ultimate Movie Draft Experience\n\n🏆 "${draft.title}" CHAMPION: ${winner.playerName}!\n📊 Winning Score: ${winner.averageScore.toFixed(1)} points\n`
      : `🎬 The Ultimate Movie Draft Experience\n\nCheck out the final scores from "${draft.title}" movie draft competition!`
    
    if (winner) {
      // Add top pick if available
      const topPick = picks
        .filter(pick => pick.player_name === winner.playerName && pick.calculated_score !== null)
        .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))[0]
      
      if (topPick) {
        description += `🎯 Power Pick: ${topPick.movie_title} (${topPick.calculated_score?.toFixed(1)}pts)\n`
      }
      
      description += `\n🏅 FINAL LEADERBOARD:\n`
      teamScores.slice(0, 3).forEach((team, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
        description += `${medal} ${team.playerName}: ${team.averageScore.toFixed(1)}pts\n`
      })
      
      if (teamScores.length > 3) {
        description += `...and ${teamScores.length - 3} more competitors!\n`
      }
      
      description += `\n⚡ Think you can draft better? #CineDraft #MovieDraft #Movies #FilmBattle`
    }

    // Escape HTML for meta tag attributes and convert newlines to spaces for better readability
    const escapedDescription = description
      .replace(/"/g, '&quot;')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const appUrl = 'https://964f15f1-a644-4dc2-849a-48e1e55bfa91.lovableproject.com'
    const finalScoresUrl = `${appUrl}/final-scores/${draftId}`
    
    // Try to get the actual share image from storage
    let imageUrl = 'https://lovable.dev/opengraph-image-p98pqg.png' // fallback
    
    try {
      const { data: files } = await supabase.storage
        .from('share-images')
        .list('', {
          search: draftId
        })
      
      if (files && files.length > 0) {
        // Get the most recent share image for this draft
        const latestFile = files
          .filter(file => file.name.includes(draftId))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        
        if (latestFile) {
          const { data: { publicUrl } } = supabase.storage
            .from('share-images')
            .getPublicUrl(latestFile.name)
          imageUrl = publicUrl
        }
      }
    } catch (error) {
      console.log('Could not fetch share image, using fallback:', error)
    }

    // Generate HTML with proper meta tags (no JavaScript redirect for crawlers)
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${escapedDescription}" />
    
    <!-- Facebook App ID -->
    <meta property="fb:app_id" content="966242223397117" />
    
    <!-- Open Graph tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${finalScoresUrl}" />
    <meta property="og:site_name" content="CineDraft" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:updated_time" content="${new Date().toISOString()}" />
    
    <!-- Open Graph Image tags -->
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapedDescription}" />
    
    <!-- Additional Open Graph tags -->
    <meta property="og:determiner" content="the" />
    <meta property="og:rich_attachment" content="true" />
    
    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:image:alt" content="${escapedDescription}" />
    <meta name="twitter:site" content="@CineDraft" />
    <meta name="twitter:creator" content="@CineDraft" />
    
    <!-- Only redirect for real users, not crawlers -->
    <script>
      // Check if this is likely a social media crawler
      const userAgent = navigator.userAgent.toLowerCase();
      const isCrawler = userAgent.includes('facebookexternalhit') || 
                       userAgent.includes('twitterbot') || 
                       userAgent.includes('linkedinbot');
      
      // Only redirect if not a crawler
      if (!isCrawler) {
        window.location.href = '${finalScoresUrl}';
      }
    </script>
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
      <h1 style="color: #333;">${title}</h1>
      <p style="color: #666; font-size: 18px;">${description}</p>
      <div style="margin: 30px 0;">
        <h2 style="color: #333;">Final Standings:</h2>
        ${teamScores.slice(0, 5).map((team, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
          return `<p style="font-size: 16px; margin: 10px 0;">${medal} <strong>${team.playerName}</strong>: ${team.averageScore.toFixed(1)} points</p>`;
        }).join('')}
      </div>
      <div style="margin-top: 40px;">
        <a href="${finalScoresUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Full Results</a>
      </div>
      <p style="color: #999; font-size: 14px; margin-top: 30px;">
        <a href="${finalScoresUrl}">Click here to view the complete draft results</a>
      </p>
    </div>
  </body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Error in share-page function:', error)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})