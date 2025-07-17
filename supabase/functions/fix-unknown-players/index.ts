
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { draftId } = await req.json()

    // Update any picks that have "Unknown Player" with the actual participant names
    const { data: picks, error: picksError } = await supabaseClient
      .from('draft_picks')
      .select('id, player_id, draft_id')
      .eq('draft_id', draftId)
      .eq('player_name', 'Unknown Player')

    if (picksError) {
      throw picksError
    }

    // For each pick with unknown player, find the correct participant name
    for (const pick of picks || []) {
      const { data: participants, error: participantError } = await supabaseClient
        .from('draft_participants')
        .select('participant_name, user_id')
        .eq('draft_id', pick.draft_id)
        .order('created_at', { ascending: true })

      if (participantError) {
        console.error('Error fetching participants:', participantError)
        continue
      }

      // Find the participant that corresponds to this player_id
      const participant = participants?.[pick.player_id - 1] // player_id is 1-indexed
      
      if (participant) {
        const { error: updateError } = await supabaseClient
          .from('draft_picks')
          .update({ player_name: participant.participant_name })
          .eq('id', pick.id)

        if (updateError) {
          console.error('Error updating pick:', updateError)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Player names updated successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
