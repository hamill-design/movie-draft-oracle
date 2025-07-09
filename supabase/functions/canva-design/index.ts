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

    // For now, let's create a simple response that opens Canva with a pre-made template
    // This is a fallback until we get the full API working
    if (action === 'create') {
      console.log('Creating Canva design redirect for:', draftTitle)
      
      // Sort teams by score for data summary
      const sortedTeams = teamScores.sort((a, b) => b.averageScore - a.averageScore)
      const winner = sortedTeams[0]
      
      // Create a data summary for the user to manually input
      const designSummary = {
        title: draftTitle,
        winner: winner.playerName,
        winnerScore: winner.averageScore.toFixed(1),
        leaderboard: sortedTeams.slice(0, 5).map((team, index) => 
          `${index + 1}. ${team.playerName} - ${team.averageScore.toFixed(1)}/10`
        ).join('\n'),
        topMovies: winner.picks
          .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
          .slice(0, 3)
          .map(pick => pick.movie_title)
          .join(', ')
      }

      console.log('Design summary created:', designSummary)

      // For now, return a Canva template URL and the data to input
      const canvaTemplateUrl = 'https://www.canva.com/design/create?type=InstagramStory&template=BAEUj8p4BNE'
      
      return new Response(JSON.stringify({ 
        success: true, 
        designId: `generated-${Date.now()}`,
        editUrl: canvaTemplateUrl,
        designData: designSummary,
        message: 'Canva template ready! Use the provided data to customize your design.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'export') {
      // For export, we'll provide instructions since we can't auto-export
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Please download your design directly from Canva using the Share -> Download option.'
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