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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { draftTitle, teamScores, action = 'create' } = await req.json()
    console.log('Canva function called with:', { action, draftTitle, teamScoresCount: teamScores?.length })
    
    const canvaApiKey = Deno.env.get('CANVA_API_KEY')
    console.log('Canva API key available:', !!canvaApiKey)

    if (!canvaApiKey) {
      console.error('Canva API key not configured')
      throw new Error('Canva API key not configured')
    }

    const baseUrl = 'https://api.canva.com/rest/v1'
    console.log('Using Canva API base URL:', baseUrl)

    if (action === 'create') {
      console.log('Creating automated Canva design with data:', { draftTitle, teamScores: teamScores.length })
      
      // Sort teams by score for leaderboard
      const sortedTeams = teamScores.sort((a, b) => b.averageScore - a.averageScore)
      const winner = sortedTeams[0]
      
      // Get top movies from winner's picks
      const topMovies = winner.picks
        .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
        .slice(0, 3)
        .map(pick => pick.movie_title)

      // Create design with automated data population
      const createResponse = await fetch(`${baseUrl}/designs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${canvaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          design_type: 'InstagramStory',
          title: `${draftTitle} - Results`,
          content: {
            elements: [
              {
                type: 'text',
                content: draftTitle,
                style: {
                  font_size: '48px',
                  font_weight: 'bold',
                  color: '#FFFFFF',
                  align: 'center'
                },
                position: { x: 50, y: 100, width: 980, height: 80 }
              },
              {
                type: 'text',
                content: `🏆 WINNER: ${winner.playerName}`,
                style: {
                  font_size: '36px',
                  font_weight: 'bold',
                  color: '#FFD700',
                  align: 'center'
                },
                position: { x: 50, y: 200, width: 980, height: 60 }
              },
              {
                type: 'text',
                content: `Final Score: ${winner.averageScore.toFixed(1)}/10`,
                style: {
                  font_size: '28px',
                  color: '#FFFFFF',
                  align: 'center'
                },
                position: { x: 50, y: 280, width: 980, height: 50 }
              },
              {
                type: 'text',
                content: 'LEADERBOARD',
                style: {
                  font_size: '24px',
                  font_weight: 'bold',
                  color: '#FFFFFF',
                  align: 'center'
                },
                position: { x: 50, y: 360, width: 980, height: 40 }
              },
              ...sortedTeams.slice(0, 5).map((team, index) => ({
                type: 'text',
                content: `${index + 1}. ${team.playerName} - ${team.averageScore.toFixed(1)}⭐`,
                style: {
                  font_size: '22px',
                  color: index === 0 ? '#FFD700' : '#FFFFFF',
                  align: 'left'
                },
                position: { x: 80, y: 420 + (index * 50), width: 920, height: 40 }
              })),
              {
                type: 'text',
                content: `Top Picks: ${topMovies.join(', ')}`,
                style: {
                  font_size: '18px',
                  color: '#CCCCCC',
                  align: 'center'
                },
                position: { x: 50, y: 750, width: 980, height: 100 }
              },
              {
                type: 'text',
                content: `#MovieDraft #${draftTitle.replace(/\s+/g, '')}`,
                style: {
                  font_size: '16px',
                  color: '#888888',
                  align: 'center'
                },
                position: { x: 50, y: 1800, width: 980, height: 40 }
              }
            ],
            background: {
              type: 'gradient',
              colors: ['#1a1a2e', '#16213e', '#0f3460']
            }
          }
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Canva API Error:', errorText)
        throw new Error(`Failed to create design: ${errorText}`)
      }

      const design = await createResponse.json()
      console.log('Design created successfully:', design.design?.id)
      
      return new Response(JSON.stringify({ 
        success: true, 
        designId: design.design.id,
        editUrl: `https://www.canva.com/design/${design.design.id}/edit`,
        previewUrl: design.design.urls?.view_url,
        message: 'Automated design created with your draft data!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'export') {
      const { designId } = await req.json()
      console.log('Exporting design:', designId)
      
      const exportResponse = await fetch(`${baseUrl}/designs/${designId}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${canvaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'PNG',
          quality: 'high',
          pages: 'all'
        })
      })

      if (!exportResponse.ok) {
        const errorText = await exportResponse.text()
        console.error('Export Error:', errorText)
        throw new Error(`Failed to export design: ${errorText}`)
      }

      const exportData = await exportResponse.json()
      console.log('Export completed:', exportData.job?.id)
      
      return new Response(JSON.stringify({ 
        success: true, 
        downloadUrl: exportData.job?.result?.urls?.[0],
        message: 'Design exported successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action specified')

  } catch (error) {
    console.error('Canva API error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})