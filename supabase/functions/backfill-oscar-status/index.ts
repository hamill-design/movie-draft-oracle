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

async function fetchOmdbByImdbId(imdbId: string): Promise<{ status: string; awards: string } | null> {
  try {
    const omdbApiKey = Deno.env.get('OMDB');
    if (!omdbApiKey) return null;
    const url = `http://www.omdbapi.com/?apikey=${omdbApiKey}&i=${encodeURIComponent(imdbId)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json?.Response !== 'True') return null;
    const awardsStr = (json.Awards || '').toLowerCase();
    let status = 'none';
    if (awardsStr.includes('won') && (awardsStr.includes('oscar') || awardsStr.includes('academy award'))) status = 'winner';
    else if (awardsStr.includes('nominated') && (awardsStr.includes('oscar') || awardsStr.includes('academy award'))) status = 'nominee';
    return { status, awards: json.Awards || '' };
  } catch {
    return null;
  }
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

        if (cached && cached.oscar_status && cached.oscar_status !== 'none' && cached.oscar_status !== 'unknown') {
          processed++;
          continue;
        }

        let status = cached?.oscar_status || 'unknown';
        let awards = '';
        if (item.imdb_id) {
          const omdb = await fetchOmdbByImdbId(item.imdb_id);
          if (omdb) { status = omdb.status; awards = omdb.awards; }
        }

        await supabase.from('oscar_cache').upsert({
          tmdb_id: item.tmdb_id,
          imdb_id: item.imdb_id || null,
          movie_title: item.title,
          movie_year: item.year,
          oscar_status: status,
          awards_data: awards,
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


