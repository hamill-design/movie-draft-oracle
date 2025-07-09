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
    const canvaApiKey = Deno.env.get('CANVA_API_KEY')

    if (!canvaApiKey) {
      throw new Error('Canva API key not configured')
    }

    const baseUrl = 'https://api.canva.com/rest/v1'

    if (action === 'create') {
      // Create a new design from template
      const createResponse = await fetch(`${baseUrl}/designs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${canvaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          design_type: 'Instagram Story',
          width: 1080,
          height: 1920,
        })
      })

      if (!createResponse.ok) {
        const error = await createResponse.text()
        throw new Error(`Failed to create design: ${error}`)
      }

      const design = await createResponse.json()
      const designId = design.design.id

      // Add content to the design
      const winner = teamScores.sort((a, b) => b.averageScore - a.averageScore)[0]
      const content = [
        {
          type: 'text',
          text: draftTitle,
          font_size: 48,
          color: '#FFFFFF',
          position: { x: 50, y: 100 }
        },
        {
          type: 'text',
          text: `🏆 Winner: ${winner.playerName}`,
          font_size: 36,
          color: '#FFD700',
          position: { x: 50, y: 200 }
        },
        {
          type: 'text',
          text: `Score: ${winner.averageScore.toFixed(1)}/10`,
          font_size: 28,
          color: '#FFFFFF',
          position: { x: 50, y: 280 }
        }
      ]

      // Add leaderboard
      teamScores.slice(0, 5).forEach((team, index) => {
        content.push({
          type: 'text',
          text: `${index + 1}. ${team.playerName} - ${team.averageScore.toFixed(1)}`,
          font_size: 24,
          color: '#FFFFFF',
          position: { x: 50, y: 400 + (index * 60) }
        })
      })

      // Update design with content (this would need actual Canva API endpoints)
      // For now, return the design ID for further processing
      
      return new Response(JSON.stringify({ 
        success: true, 
        designId,
        editUrl: `https://www.canva.com/design/${designId}/edit`,
        message: 'Design created successfully. You can edit it in Canva.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'export') {
      const { designId } = await req.json()
      
      // Export the design
      const exportResponse = await fetch(`${baseUrl}/designs/${designId}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${canvaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'PNG',
          quality: 'high'
        })
      })

      if (!exportResponse.ok) {
        const error = await exportResponse.text()
        throw new Error(`Failed to export design: ${error}`)
      }

      const exportData = await exportResponse.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        downloadUrl: exportData.urls[0],
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