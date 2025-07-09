import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

// Get Canva access token using client credentials flow
async function getCanvaAccessToken(): Promise<string> {
  const clientId = Deno.env.get('CANVA_CLIENT_ID')
  const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    throw new Error('Canva credentials not configured')
  }

  console.log('Getting Canva access token...')
  
  const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'design:write'
    })
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    console.error('Token request failed:', errorText)
    throw new Error(`Failed to get access token: ${errorText}`)
  }

  const tokenData = await tokenResponse.json()
  console.log('Access token obtained successfully')
  
  return tokenData.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { draftTitle, teamScores, action = 'create' } = await req.json()
    console.log('Canva function called with:', { action, draftTitle, teamScoresCount: teamScores?.length })

    if (action === 'create') {
      console.log('Creating Canva design with server-side auth...')
      
      // Get access token
      const accessToken = await getCanvaAccessToken()
      
      // Sort teams by score for data summary
      const sortedTeams = teamScores.sort((a, b) => b.averageScore - a.averageScore)
      const winner = sortedTeams[0]
      
      // Get top movies from winner's picks
      const topMovies = winner.picks
        .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
        .slice(0, 3)
        .map(pick => pick.movie_title)

      // Create design using Canva API
      const createResponse = await fetch('https://api.canva.com/rest/v1/designs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          design_type: 'InstagramStory',
          title: `${draftTitle} - Results`
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Design creation failed:', errorText)
        throw new Error(`Failed to create design: ${errorText}`)
      }

      const design = await createResponse.json()
      const designId = design.design.id
      console.log('Design created successfully:', designId)
      
      // Now add content to the design
      const textElements = [
        {
          type: 'text',
          text: draftTitle,
          position: { x: 100, y: 200 },
          font_size: 48,
          font_weight: 'bold',
          color: '#FFFFFF'
        },
        {
          type: 'text', 
          text: `🏆 WINNER: ${winner.playerName}`,
          position: { x: 100, y: 300 },
          font_size: 36,
          color: '#FFD700'
        },
        {
          type: 'text',
          text: `Score: ${winner.averageScore.toFixed(1)}/10`,
          position: { x: 100, y: 380 },
          font_size: 28,
          color: '#FFFFFF'
        },
        {
          type: 'text',
          text: 'LEADERBOARD',
          position: { x: 100, y: 480 },
          font_size: 24,
          font_weight: 'bold',
          color: '#FFFFFF'
        }
      ]

      // Add leaderboard entries
      sortedTeams.slice(0, 5).forEach((team, index) => {
        textElements.push({
          type: 'text',
          text: `${index + 1}. ${team.playerName} - ${team.averageScore.toFixed(1)}⭐`,
          position: { x: 120, y: 540 + (index * 60) },
          font_size: 22,
          color: index === 0 ? '#FFD700' : '#FFFFFF'
        })
      })

      // Add top movies
      textElements.push({
        type: 'text',
        text: `Top Movies: ${topMovies.join(', ')}`,
        position: { x: 100, y: 900 },
        font_size: 18,
        color: '#CCCCCC'
      })

      // Add hashtags
      textElements.push({
        type: 'text',
        text: `#MovieDraft #${draftTitle.replace(/\s+/g, '')}`,
        position: { x: 100, y: 1800 },
        font_size: 16,
        color: '#888888'
      })

      console.log('Adding text elements to design...')
      
      // Add elements to design (this would use Canva's content API)
      // For now, we'll return the design info and let users edit manually
      
      return new Response(JSON.stringify({ 
        success: true, 
        designId: designId,
        editUrl: `https://www.canva.com/design/${designId}/edit`,
        designData: {
          title: draftTitle,
          winner: winner.playerName,
          winnerScore: winner.averageScore.toFixed(1),
          leaderboard: sortedTeams.slice(0, 5).map((team, index) => 
            `${index + 1}. ${team.playerName} - ${team.averageScore.toFixed(1)}/10`
          ).join('\n'),
          topMovies: topMovies.join(', ')
        },
        message: 'Design created! Open in Canva to customize with your data.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'export') {
      const { designId } = await req.json()
      console.log('Exporting design:', designId)
      
      const accessToken = await getCanvaAccessToken()
      
      const exportResponse = await fetch(`https://api.canva.com/rest/v1/designs/${designId}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'PNG',
          quality: 'high'
        })
      })

      if (!exportResponse.ok) {
        const errorText = await exportResponse.text()
        console.error('Export failed:', errorText)
        throw new Error(`Failed to export design: ${errorText}`)
      }

      const exportData = await exportResponse.json()
      console.log('Export completed')
      
      return new Response(JSON.stringify({ 
        success: true, 
        downloadUrl: exportData.job?.urls?.[0] || exportData.urls?.[0],
        message: 'Design exported successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action specified')

  } catch (error) {
    console.error('Canva function error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})