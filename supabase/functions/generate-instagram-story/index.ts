import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { draftId, draftTitle, teamScores } = await req.json()

    if (!draftId || !draftTitle || !teamScores) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: draftId, draftTitle, teamScores' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get winner and create story text
    const winner = teamScores[0]
    const storyText = `🎬 ${draftTitle} Results!\n\n🏆 Winner: ${winner.playerName}\n📊 Score: ${winner.averageScore.toFixed(1)}\n\n🎯 ${winner.completedPicks}/${winner.totalPicks} picks scored\n\n#MovieDraft #DraftResults`

    // Generate Instagram Story optimized image (1080x1920, no rounded edges)
    const imagePrompt = `Create a vibrant Instagram story image for movie draft results. 
    IMPORTANT: Exact dimensions 1080x1920 pixels, vertical orientation, NO rounded corners or borders.
    Title: "${draftTitle}"
    Winner: "${winner.playerName}" with score ${winner.averageScore.toFixed(1)}
    Style: Modern, clean design with movie theme, trophy elements, and celebration vibes.
    Format: Full bleed Instagram story (9:16 aspect ratio), sharp rectangular edges.
    Include bold typography, cinema/movie themed graphics, winner celebration elements.
    Background should fill entire frame with no padding or margins.
    Colors: Vibrant and eye-catching for social media.`

    // Call OpenAI to generate the image
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        size: '1080x1920',
        quality: 'high',
        output_format: 'png',
        background: 'opaque'
      }),
    })

    if (!imageResponse.ok) {
      const error = await imageResponse.json()
      console.error('OpenAI API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate image', details: error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const imageData = await imageResponse.json()
    const imageBase64 = imageData.data[0].b64_json

    // Convert base64 to blob for upload
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    
    // Upload to Supabase Storage
    const fileName = `instagram-story-${draftId}-${Date.now()}.png`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('share-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload image', details: uploadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('share-images')
      .getPublicUrl(fileName)

    return new Response(
      JSON.stringify({ 
        success: true,
        imageUrl: publicUrl,
        storyText: storyText,
        instagramTips: {
          image: "Download the generated image and upload it to your Instagram story",
          text: "Copy the story text and paste it as a caption or text overlay",
          hashtags: "#MovieDraft #DraftResults #Cinema #Movies",
          businessAPI: "For automated posting, you'll need an Instagram Business account and Meta Developer access"
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})