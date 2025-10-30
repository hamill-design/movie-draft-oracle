import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface BackfillItem {
  tmdb_id: number;
  title: string;
  year: number;
  imdb_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    for (const item of items as BackfillItem[]) {
      try {
        // If cache already has a non-none status, skip
        const { data: cached } = await supabase
          .from('oscar_cache')
          .select('oscar_status')
          .eq('tmdb_id', item.tmdb_id)
          .eq('movie_year', item.year || null)
          .single();

        if (cached && cached.oscar_status && cached.oscar_status !== 'none') {
          processed++;
          continue;
        }

        // Minimal upsert placeholder (actual enrichment can be added later)
        await supabase.from('oscar_cache').upsert({
          tmdb_id: item.tmdb_id,
          movie_title: item.title,
          movie_year: item.year,
          oscar_status: cached?.oscar_status || 'none',
          updated_at: new Date().toISOString(),
        });

        processed++;
      } catch (e) {
        console.log('Backfill item error:', e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


